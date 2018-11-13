'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { runGreenlight } from './greenlight';

const extensionId = 'ctcampbell-com.vscode-unofficial-veracode-greenlight-java';
const extension = vscode.extensions.getExtension(extensionId)!;

export let greenlightDiagnosticCollection: vscode.DiagnosticCollection;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.vsCodeGreenlightJava', () => runGreenlight());
    context.subscriptions.push(disposable);

    greenlightDiagnosticCollection = vscode.languages.createDiagnosticCollection(extension.packageJSON.shortName);
	context.subscriptions.push(greenlightDiagnosticCollection);
}

// this method is called when your extension is deactivated
export function deactivate() {
}