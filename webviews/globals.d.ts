import * as _vscode from 'vscode';

declare global {
    const ts_vscode: {
        postMessage: ({type: string, options: any}) => void;
    };
};