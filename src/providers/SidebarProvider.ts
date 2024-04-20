import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import * as cp from 'child_process';
import { readFile } from "fs";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;

  constructor(private readonly _extensionUri: vscode.Uri) {}

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

              
              // const terminal = vscode.window.createTerminal();
              // terminal.sendText(`cd "${workspaceFolder.uri.fsPath}"`);
              // terminal.sendText(`git fetch ${remoteOrigin} ${sourceBranch}`);
              
              // @todo - fetch this branch using the remote url
              await this.executeGitCommand(`cd "${workspaceFolder.uri.fsPath}"`, workspaceFolder);

              await this.executeGitCommand(`git fetch ${remoteOrigin} ${sourceBranch}`, workspaceFolder);

              console.log(`Branch '${sourceBranch}' fetched successfully`);

              // terminal.sendText(`git merge --no-commit ${sourceBranch}`);
              await this.executeGitCommand(`git merge --no-commit ${sourceBranch}`, workspaceFolder);
              
              // @todo - identify conflicted files
              const output = await this.executeGitCommand(`git status --porcelain`, workspaceFolder);
              console.log(output);
              const conflictedFiles = output.split('\n')
                  .filter(file => file.startsWith('UU')).map(file => file.split(' ')[1]); // 'UU' indicates merge conflict
              console.log('conflicted files: ', conflictedFiles);

              // @todo - extract conflicted parts in those files
              let conflictedParts = [];
              for(const file of conflictedFiles) {
                const filePath = `${workspaceFolder.uri.fsPath}\\${file}`;
                // const output = await this.executeGitCommand(`git diff ${filePath}`, workspaceFolder);
                const output = await this.readFile(filePath);
                console.log(JSON.stringify(output));
                const matches = [...output.matchAll(/<<<<<<< HEAD[\s\S]*?=======[\s\S]*?>>>>>>> [a-z0-9]+/g)];
                conflictedParts.push({filePath, conflicts: matches.map(match => match[0])});
              }

              console.log(conflictedParts);

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

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

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