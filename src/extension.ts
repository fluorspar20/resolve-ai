import * as vscode from 'vscode';
import { SidebarProvider } from './providers/SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
		"merge-conflict-resolver-sidebar", sidebarProvider)
	);

	vscode.window.onDidChangeActiveTextEditor(editor => {
    console.log('inside listener');
		if (editor) {
			const conflictStartPositions = sidebarProvider.conflictStartPositions;
			const conflictResolutionLines = sidebarProvider.conflictResolutionLines;
      const filePath = editor.document.uri.fsPath;

      console.log(filePath);
      

      if(conflictResolutionLines.has(filePath)){
        const lines = conflictResolutionLines.get(filePath)?.length;
        if(!lines) {
          console.log('No conflicts found in this file.');
          return;
        }
        for(let i=0;i<lines;i++) {  
          console.log(conflictStartPositions.get(filePath)?.at(i), conflictResolutionLines.get(filePath)?.at(i));
          
          highlightConflicts(editor, conflictStartPositions.get(filePath)?.at(i), 
            conflictResolutionLines.get(filePath)?.at(i));
          
        }
      }
		}
	}, null, context.subscriptions);

}

const highlightConflicts = (editor: vscode.TextEditor, conflictStartPosition: number | undefined, conflictResolutionLine: number | undefined): void => {
    console.log('inside highlight extension.ts', conflictStartPosition, conflictResolutionLine);
    
    
    const decorations: vscode.DecorationOptions[] = [];

    if(!conflictStartPosition || !conflictResolutionLine) {
      throw new Error('start/line not defined.');
    }

    const range = new vscode.Range(conflictStartPosition, 0, conflictStartPosition + conflictResolutionLine, 0);
    const decoration = { range, hoverMessage: 'Resolution line' };
    decorations.push(decoration);
        

    editor.setDecorations(conflictResolutionDecorationType, decorations);
  };

  const conflictResolutionDecorationType = vscode.window.createTextEditorDecorationType({
	// Add your decoration style here
	backgroundColor: 'rgba(255, 255, 0, 0.5)'
  });
  