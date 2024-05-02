import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import * as cp from 'child_process';
import { readFile, readFileSync, writeFileSync } from "fs";
import { GenerateContentCandidate, GoogleGenerativeAI } from "@google/generative-ai";


interface Conflict {
  filePath: string;
  conflicts: string[];
}

interface Resolution {
  filePath: string;
  conflict: string;
  resolution: GenerateContentCandidate[];
}


export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;
  conflictStartPositions: Map<string, number[]>;
  conflictResolutionLines: Map<string, number[]>;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.conflictResolutionLines = new Map();
    this.conflictStartPositions =  new Map();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "fetchCode": {
          const {sourceBranch, remoteOrigin} = data.options;
          try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Assuming there is only one workspace folder open

            if(workspaceFolder) {
              await this.executeGitCommand(`cd "${workspaceFolder.uri.fsPath}"`, workspaceFolder);

              await this.executeGitCommand(`git fetch ${remoteOrigin} ${sourceBranch}`, workspaceFolder);

              console.log(`Branch '${sourceBranch}' fetched successfully`);

              await this.executeGitCommand(`git merge --no-commit ${sourceBranch}`, workspaceFolder);
              
              const output = await this.executeGitCommand(`git status --porcelain`, workspaceFolder);
              console.log(output);
              const conflictedFiles = output.split('\n')
                  .filter(file => file.startsWith('UU')).map(file => file.split(' ')[1]); // 'UU' indicates merge conflict
              console.log('conflicted files: ', conflictedFiles);

              let conflictedParts = [];
              for(const file of conflictedFiles) {
                const filePath = `${workspaceFolder.uri.fsPath}\\${file.replace(/\//g, "\\")}`;
                const output = await this.readFile(filePath);
                const matches = [...output.matchAll(/<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> [a-z0-9]+/g)];
                conflictedParts.push({filePath, conflicts: matches.map(match => match[0])});
              }

              console.log(conflictedParts);

              const conflictStartPositions = this.getConflictStartPositions(conflictedParts);
              this.conflictStartPositions = conflictStartPositions;

              const curBranch = await this.executeGitCommand(`git branch --show-current`, workspaceFolder);
              
              let conflictResolutions = [];
              const genAI = new GoogleGenerativeAI(`${process.env.API_KEY}`);
              const model = genAI.getGenerativeModel({ model: "gemini-pro" });
              for(const conflictedPart of conflictedParts) {
                const {filePath, conflicts} = conflictedPart;
                for(const conflict of conflicts) {
                    let prompt = "Resolve the provided git conflict. your response should only contain the resolved code. \
                              Do not remove any extra code. The output should always be the most \
                              likely resolutions of the conflict listed in an array one after another. Maintain the indentation \
                              of the code in resolution also. The resolution should have the exact number of lines as the original \
                              piece of code where the conflict occured. Don't add the language specifier in your response, just give me the code. \n";
                    prompt += `I am working on the ${curBranch} branch, at the HEAD of the commit chain. \n\n`;
                    prompt += conflict;

                    console.log(prompt);
                    
                    const result = await model.generateContent(prompt);
                    if(!result.response.candidates){
                      throw new Error('Merge conflict could not be resolved.');
                    }

                    this.resolveMergeConflict(conflict, filePath, result.response.candidates[0].content.parts[0].text);
                    conflictResolutions.push({filePath, conflict: conflict, resolution: result.response.candidates});

                }
              }

              const conflictResolutionLines = this.getResolutionLines(conflictResolutions);
              this.conflictResolutionLines = conflictResolutionLines;
              console.log(conflictResolutions);
            }
          } catch (err) {
            vscode.window.showErrorMessage("Some error occured.");
            console.log(err);
            break;
          }
        }
      }
    });
  }

  private getConflictStartPositions = (conflicts: Conflict[]) : Map<string,number[]> => {
    let conflictStartPositionsMap = new Map();
    for(const conflict of conflicts) {
      const {filePath, conflicts} = conflict;
      let fileContent = readFileSync(filePath, 'utf8');
      console.log('file', fileContent);
      

      const lines = fileContent.split("\n");
      for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(/<<<<<<< HEAD/g);
          if (match) {
            if (conflictStartPositionsMap.has(filePath)) {
              // If the key exists, push the value to the existing array
              conflictStartPositionsMap.get(filePath).push(i);
            } else {
                // If the key doesn't exist, create a new array with the value
                conflictStartPositionsMap.set(filePath, [i]);
            }
          }
      } 
    };

    console.log('conflictStartPositionsMap', conflictStartPositionsMap);
    return conflictStartPositionsMap;

  };

  private getResolutionLines = (conflictResolutions: Resolution[]) : Map<string,number[]> => {
    let conflictResolutionLinesMap = new Map();
    
    for (const conflictResolution of conflictResolutions) {
      const {filePath, conflict, resolution} = conflictResolution;
      const resolutionText = resolution[0].content.parts[0].text;
      const resolvedContent = resolutionText?.replace(/^```\n/, '').replace(/\n```$/, '');

      if (conflictResolutionLinesMap.has(filePath)) {
        // If the key exists, push the value to the existing array
        conflictResolutionLinesMap.get(filePath).push(resolvedContent?.split("\n").length);
      } else {
          // If the key doesn't exist, create a new array with the value
          conflictResolutionLinesMap.set(filePath, [resolvedContent?.split("\n").length]);
      }
    };
    console.log('conflictResolutionLinesMap', conflictResolutionLinesMap);
    return conflictResolutionLinesMap;
  };

  private executeGitCommand = async (command: string, workspaceFolder: vscode.WorkspaceFolder) => {
    return new Promise<string>((resolve, reject) => {
        cp.exec(command, {cwd: workspaceFolder.uri.fsPath}, (error, stdout, stderr) => {
            if (error && error.code !== 1) {
                console.log(error.message, error.code);
                reject(new Error(`Command execution failed: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });
    });
  };

  private readFile = async (filePath: string) => {
    return new Promise<string>((resolve, reject) => {
      readFile(filePath, 'utf8', (err, data) => {
          if (err) {
              reject(err);
          } else {
              resolve(data);
          }
      });
    });
  };

  private resolveMergeConflict = (conflict: string, filePath: string, resolution: string | undefined): void => {
    try {
      if(!resolution){
        throw new Error('Merge conflict could not be resolved.');
      }
        let fileContent = readFileSync(filePath, 'utf8');

        const resolvedContent = resolution
            .replace(/^```\n/, '')
            .replace(/\n```$/, '');

        fileContent = fileContent.replace(conflict, resolvedContent);
        writeFileSync(filePath, fileContent);

        console.log(`Merge conflict resolved in file: ${filePath}`);
    } catch (error) {
        console.error('Error resolving merge conflict:', error);
    }
  };

  

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  };

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/sidebar.js")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "out", "compiled/sidebar.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${
      webview.cspSource
    }; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
			</head>
      <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
        <script nonce="${nonce}">
          const ts_vscode = acquireVsCodeApi();
        </script>
			</body>
			</html>`;
  }
}