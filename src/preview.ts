/* This file contains functions relevant for Snooty Preview */

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { startWebview } from "./webview";

// Registers Snooty Preview as a usable command
export function registerSnootyPreview(client: LanguageClient, context: vscode.ExtensionContext): void {
	const snootyPreview: vscode.Disposable = vscode.commands.registerCommand('snooty.snootyPreview', async () => {
		const projectName: string = await getProjectName(client);
		const previewPage: string = await getPageFileId(client);
	
		// Create task for Snooty Preview
		const previewBundleTask: vscode.Task = createPreviewBundleTask(context, previewPage, projectName);
		vscode.tasks.onDidEndTask((e) => {
				if (e.execution.task === previewBundleTask) {
						startWebview(context, projectName, previewPage);
				}
		});
	
		await vscode.commands.executeCommand('snooty.getPageAST');
		await vscode.tasks.executeTask(previewBundleTask);
	});

	context.subscriptions.push(snootyPreview);
}

// Get the project name of the current repo
async function getProjectName(client: LanguageClient): Promise<string> {
	return await client.sendRequest("textDocument/get_project_name", {});
}

// Get the file id of the file currently using Snooty Preview
async function getPageFileId(client: LanguageClient): Promise<string> {
	const textDocument: vscode.TextDocument = vscode.window.activeTextEditor.document;
	const fileName: string = textDocument.fileName;
	return await client.sendRequest("textDocument/get_page_fileid", {filePath: fileName});
}

// Create task to run webpack on snooty frontend via npm run preview
function createPreviewBundleTask(context: vscode.ExtensionContext, previewPage: string, projectName: string): vscode.Task {
	const envPreviewPage = `--env.PREVIEW_PAGE='${previewPage}'`;
	const envProjectName = `--env.PROJECT_NAME='${projectName}'`;
	const task: vscode.Task = new vscode.Task(
			{type: 'previewProvider'},
			vscode.TaskScope.Workspace,
			"Snooty Preview: Webpack Bundle",
			"snooty"
	);

	// For testing purposes, we want to see the terminal output
	task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			panel: vscode.TaskPanelKind.New
	};
	task.execution = new vscode.ShellExecution(
			`npm run preview -- ${envPreviewPage} ${envProjectName}`,
			{ cwd: context.extensionPath }
	);

	return task;
}