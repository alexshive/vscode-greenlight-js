import os = require('os');
import fs = require('fs');
import JSZip = require('jszip');
import path = require('path');
import request = require('request');
import veracodehmac = require('./veracode-hmac');
import ConfigParser = require('configparser');
import * as vscode from 'vscode';
import { greenlightDiagnosticCollection } from './extension';
import { setTimeout } from 'timers';

const extensionId = 'ctcampbell-com.vscode-unofficial-veracode-greenlight-java';
const extension = vscode.extensions.getExtension(extensionId)!;

const protocol = 'https://';
const host = 'api.veracode.com';
const basePath = '/greenlight/v3';
const scanPath = '/scan/java';
const ua = `${extension.packageJSON.publisher}.${extension.packageJSON.name} ${extension.packageJSON.version}, vscode ${vscode.version}`;

const extensionConfig = vscode.workspace.getConfiguration('greenlightJava');
const sourceDirectory = extensionConfig['sourceFolder'];
const classDirectory = extensionConfig['classFolder'];
const authProfile = extensionConfig['authProfile'];

const config = new ConfigParser();
const veracodeCredsFile = path.join(os.homedir(), '.veracode', 'credentials');
config.read(veracodeCredsFile);
const id = config.get(authProfile, 'veracode_api_key_id');
const key = config.get(authProfile, 'veracode_api_key_secret'); 

const diagnosticSource = extension.packageJSON.shortName;

const outputChannel = vscode.window.createOutputChannel(extension.packageJSON.shortName);
const diagnosticsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export function runGreenlight() {
	outputChannel.clear();
	outputChannel.show();
	sendLogMessage(`Version: ${ua}`);

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
	}
	
	if (editor.document.languageId !== 'java') {
		vscode.window.showInformationMessage('File in the active editor is not a Java file');
		return;
	}
	if (editor.document.isUntitled) {
		vscode.window.showInformationMessage('File in the active editor has not been saved');
		return;
	}

	let classFilePath = editor.document.fileName.replace(sourceDirectory, classDirectory).replace('.java', '.class');
	if (!fs.existsSync(classFilePath)) {
		vscode.window.showInformationMessage('Compiled .class not found for file in the active editor');
		return;
	}

	greenlightDiagnosticCollection.clear();
	let fileName = path.basename(editor.document.fileName);

	diagnosticsStatusBarItem.show();
	diagnosticsStatusBarItem.text = `Scanning ${fileName}`;
	sendLogMessage(`Scanning ${fileName}`);

	uploadJar(editor.document.uri, classFilePath);
}

function uploadJar(documentUri: vscode.Uri, classFilePath: string) {
	var options = {
		uri: protocol + host + basePath + scanPath,
		headers: {
			'User-Agent': ua,
			'Authorization': veracodehmac.calculateAuthorizationHeader(id, key, host, basePath + scanPath, '', 'POST')
		},
		formData: {},
		json: true
	};

	var zip = new JSZip();
	zip.file(path.basename(classFilePath), fs.readFileSync(classFilePath));

	let anonymousClassFileName = classFilePath.replace('.class', '$1.class');
	if (fs.existsSync(anonymousClassFileName)) {
		zip.file(path.basename(anonymousClassFileName), fs.readFileSync(anonymousClassFileName));
	}

	zip.generateAsync({type: 'nodebuffer'}).then(function (buff: Buffer) {
		options.formData = {
			file: {
				value: buff,
				options: {
					filename:  'upload.jar',
					contentType: 'application/java-archive'
				}
			}
		};
	
		request.post(options, function (err, httpResponse, body) {
			if (err) {
				scanError(err);
				return;
			}
			if (httpResponse.statusCode === 200) {
				sendLogMessage('Scan submitted');
				handleUploadResponse(documentUri, body._links.result.href);
			} else {
				scanFailed();
			}
			
		});
	});
}

function handleUploadResponse(documentUri: vscode.Uri, resultsHref: string) {
	var options = {
		uri: protocol + host + basePath + resultsHref,
		headers: {
			'User-Agent': ua,
			'Authorization': veracodehmac.calculateAuthorizationHeader(id, key, host, basePath + resultsHref, '', 'GET')
		},
		json: true
	};

	request.get(options, function (err, httpResponse, body) {
		if (err) {
			scanError(err);
			return;
		}
		if (httpResponse.statusCode === 202) {
			sendLogMessage('Scan in progress');
			setTimeout(function () {
				handleUploadResponse(documentUri, body._links.self.href);
			}, 3000);
			return;
		} else if (httpResponse.statusCode === 200) {
			sendLogMessage(`Scan status ${body.scan_status.toLowerCase()}`);
			if (body.scan_status.toLowerCase() === 'success') {
				let issues = body.results.TestResults.Issues.Issue || [];
				handleDiagnostics(documentUri, issues);
			} else {
				scanFailed();
			}
		} else {
			scanFailed();
		}
	});
}

function handleDiagnostics(documentUri: vscode.Uri, issues: any) {
	let diagnostics: vscode.Diagnostic[] = [];

	for (var i = 0; i < issues.length; i++) {
		let issue = issues[i];
		let line = parseInt(issue.Files.SourceFile.Line);

		let range = new vscode.Range(line - 1 , 0, line - 1, Number.MAX_VALUE);
		let severity = mapSeverityToVSCodeSeverity(issue.Severity);
		let diagnostic = new vscode.Diagnostic(range, issue.IssueType, severity);
		diagnostic.source = diagnosticSource;
		let issueDisplayText = issue.DisplayText.replace(/(<([^>]+)>)/ig,'');
		diagnostic.relatedInformation = [new vscode.DiagnosticRelatedInformation(new vscode.Location(documentUri, range), issueDisplayText)];
		
		diagnostics.push(diagnostic);
	}
	diagnostics.sort((a, b) => a.severity - b.severity);

	greenlightDiagnosticCollection.set(documentUri, diagnostics);
	sendLogMessage(`Scan complete ${diagnostics.length} issues found`);
	diagnosticsStatusBarItem.hide();
}

function makeTimestamp(): string {
	let now = new Date();
	return `[${now.toTimeString()}]`;
}

function sendLogMessage(message: string) {
	outputChannel.appendLine(`${makeTimestamp()} ${message}`);
}

function mapSeverityToVSCodeSeverity(sev: string): vscode.DiagnosticSeverity {
	switch (sev) {
		case '5':
		case '4': return vscode.DiagnosticSeverity.Error;
		case '3': return vscode.DiagnosticSeverity.Warning;
		default: return vscode.DiagnosticSeverity.Information;
	}
}

function scanFailed() {
	vscode.window.showInformationMessage('Scanning failed');
	sendLogMessage('Scanning failed');
	diagnosticsStatusBarItem.text = 'Scanning failed';
}

function scanError(err: any) {
	vscode.window.showInformationMessage('Error: ' + err);
	sendLogMessage('Error: ' + err);
	diagnosticsStatusBarItem.text = 'Scanning error';
}
