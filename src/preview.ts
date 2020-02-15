/* This file contains functions relevant for Snooty Preview */

import { promisify } from "util";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { LanguageClient } from "vscode-languageclient";
import { startWebview } from "./webview";

// Registers Snooty Preview as a usable command
export function registerSnootyPreview(
  client: LanguageClient,
  context: vscode.ExtensionContext,
  extension: vscode.Extension<any>
): void {
  const snootyPreview: vscode.Disposable = vscode.commands.registerCommand(
    "snooty.snootyPreview",
    async () => {
      const activeTextEditor = vscode.window.activeTextEditor;
      if (!activeTextEditor) {
        return;
      }
      const textDocument: vscode.TextDocument = activeTextEditor.document;
      const fileName: string = textDocument.fileName;

      const projectName: string = await getProjectName(client);
      const previewPage: string = await getPageFileId(client, fileName);

      // Create task for Snooty Preview
      const previewBundleTask: vscode.Task = createPreviewBundleTask(
        context,
        previewPage,
        projectName
      );
      vscode.tasks.onDidEndTask(e => {
        if (e.execution.task === previewBundleTask) {
          startWebview(context, projectName, previewPage);
        }
      });

      // Snooty Preview task should really only run if valid ast is received
      const getPageASTStatus = await getPageAST(client, extension, fileName);
      if (!getPageASTStatus) {
        await vscode.tasks.executeTask(previewBundleTask);
      }
    }
  );

  context.subscriptions.push(snootyPreview);
}

// Get the project name of the current repo
async function getProjectName(client: LanguageClient): Promise<string> {
  return await client.sendRequest("textDocument/get_project_name", {});
}

// Get the file id of the file currently using Snooty Preview
async function getPageFileId(client: LanguageClient, fileName: string): Promise<string> {
  return await client.sendRequest("textDocument/get_page_fileid", {
    filePath: fileName
  });
}

// Writes the AST of a page into a json file located in snooty-frontend
// Returns 0 on success, 1 on failure (i.e. an unsupported file)
async function getPageAST(
  client: LanguageClient,
  extension: vscode.Extension<any>,
  fileName: string
): Promise<Number> {
  if (hasValidExtension(fileName)) {
    const ast = await client.sendRequest("textDocument/get_page_ast", { fileName })
    const astFilePath = path.resolve(
      extension.extensionPath,
      "snooty-frontend/preview",
      "page-ast.json"
    );
    await promisify(fs.writeFile)(astFilePath, JSON.stringify(ast));

    return 0;
  }

  // Return status 1 if Snooty Preview should not work (i.e. previewing a yaml file)
  const errorMsg =
    "ERROR: Snooty Preview command does not support this file type.";
  vscode.window.showErrorMessage(errorMsg);
  return 1;
}

// Checks fileName if it ends with an extension valid for Snooty Preview
function hasValidExtension(fileName: string) {
  const extensions = [".txt", ".rst"];
  return extensions.some(ext => fileName.endsWith(ext));
}

// Create task to run webpack on snooty frontend via npm run preview
function createPreviewBundleTask(
  context: vscode.ExtensionContext,
  previewPage: string,
  projectName: string
): vscode.Task {
  const envPreviewPage = `--env.PREVIEW_PAGE='${previewPage}'`;
  const envProjectName = `--env.PROJECT_NAME='${projectName}'`;
  const task: vscode.Task = new vscode.Task(
    { type: "previewProvider" },
    vscode.TaskScope.Workspace,
    "Snooty Preview: Create Webpack Bundle",
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
