import * as vscode from "vscode";
import { getNonce } from "../utils/getNonce";
import simpleGit, {SimpleGit} from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

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
        case "onInfo": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage(data.value);
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
        case "fetchCode": {
          console.log('message', data.options.sourceBranch, data.options.remoteUrl);
          const {sourceBranch, remoteUrl} = data.options;
          //   // repo urls are of form - https://github.com/<username>/<repo_name>.git
          // const repoName = remoteUrl.split('/').slice(-1)[0].replace('.git','');
          // const tempDir = 'C:/Amogh/Projects/test';
          // const git: SimpleGit = simpleGit();

          // try {
            
          //   await git.cwd(tempDir).clone(remoteUrl);
          //     // Checkout the desired branch
          //   await git.cwd(`${tempDir}/${repoName}`).checkout(sourceBranch);
          //   console.log('Code for branch', sourceBranch, 'fetched successfully');
          // } catch(err){
          //   console.error('Error fetching code: ', err);
          // }
          
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0]; // Assuming there is only one workspace folder open

          // if (workspaceFolder) {
          //     // Get the Git extension
          //     const gitExtension = vscode.extensions.getExtension('vscode.git');
          //     if (gitExtension) {
          //         const gitAPI = gitExtension.exports.getAPI(1);

          //         // Get the repository for the active workspace folder
          //         const repository = gitAPI.repositories.find((repo: { rootUri: { fsPath: string; }; }) => repo.rootUri?.fsPath === workspaceFolder.uri.fsPath);
          //         if (repository) {
          //             // Get the remote URLs associated with the repository
          //             const remoteUrls = repository.state.remotes.map((remote: { fetchUrl: any; }) => remote.fetchUrl);
          //             console.log(remoteUrls);
          //         }
          //     }
          // }

          if(workspaceFolder) {
            const terminal = vscode.window.createTerminal();
            terminal.sendText(`cd "${workspaceFolder.uri.fsPath}"`);
            terminal.sendText(`git fetch origin ${sourceBranch}`);

            console.log(`Branch '${sourceBranch}' fetched successfully`);

            terminal.sendText(`git merge --no-commit ${sourceBranch}`);
            // const conflictMarkers: string[] = [];
            // terminal.onDidWriteData(data => {
            //     // Parse the terminal output to find conflict markers
            //     const matches = data.match(/<{7}([\s\S]*?)={7}([\s\S]*?)>{7}/g);
            //     if (matches) {
            //         conflictMarkers.push(...matches);
            //     }
            // });
          }


                

        }
      }
    });
  }

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