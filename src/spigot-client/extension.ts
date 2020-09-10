/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
// Adapted from Microsoft VS Code extension example
import * as path from "path";
import {
  workspace as Workspace,
  window as Window,
  ExtensionContext,
  TextDocument,
  OutputChannel,
  WorkspaceFolder,
  Uri,
} from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  TransportKind,
} from "vscode-languageclient";

let clients: Map<string, LanguageClient> = new Map();
let isActive = false;
let modulePath: string = "";
let _sortedWorkspaceFolders: string[] | undefined;
let outputChannel: OutputChannel;

function sortedWorkspaceFolders(): string[] {
  if (_sortedWorkspaceFolders === void 0) {
    _sortedWorkspaceFolders = Workspace.workspaceFolders
      ? Workspace.workspaceFolders
          .map((folder) => {
            let result = folder.uri.toString();
            if (result.charAt(result.length - 1) !== "/") {
              result = result + "/";
            }
            return result;
          })
          .sort((a, b) => {
            return a.length - b.length;
          })
      : [];
  }
  return _sortedWorkspaceFolders;
}

Workspace.onDidChangeWorkspaceFolders(
  () => (_sortedWorkspaceFolders = undefined)
);

function isEnabled(): boolean {
  return Workspace.getConfiguration("snooty").get<boolean>("spigot.enabled");
}

Workspace.onDidChangeConfiguration(() => {
  console.log("Configuration changed");
  const enabled = isEnabled();
  if (enabled && !isActive) {
    outputChannel.appendLine("Activating Snooty Spigot...");
    continueActivation();
  } else if (!enabled && isActive) {
    outputChannel.appendLine("Snooty Spigot hibernating...");
    deactivate();
  }
});

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
  const sorted = sortedWorkspaceFolders();
  for (const element of sorted) {
    let uri = folder.uri.toString();
    if (uri.charAt(uri.length - 1) !== "/") {
      uri = uri + "/";
    }
    if (uri.startsWith(element)) {
      return Workspace.getWorkspaceFolder(Uri.parse(element))!;
    }
  }
  return folder;
}

export function activate(context: ExtensionContext) {
  // While this extension is experimental and dependent on Snooty,
  // we can hibernate if the sub-extension is not enabled in the settings.
  modulePath = context.asAbsolutePath(
    path.join("out", "spigot-server", "server.js")
  );
  outputChannel = Window.createOutputChannel("Snooty Spigot");

  if (!isEnabled()) {
    outputChannel.appendLine(
      "Activate called while Snooty Spigot is not enabled. Hibernating..."
    );
    return;
  }

  continueActivation();
}

function continueActivation() {
  isActive = true;
  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (
      document.languageId !== "restructuredtext" ||
      (document.uri.scheme !== "file" && document.uri.scheme !== "untitled")
    ) {
      return;
    }

    const uri = document.uri;

    let folder = Workspace.getWorkspaceFolder(uri);
    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return;
    }
    // If we have nested workspace folders we only start a server on the outer most workspace folder.
    folder = getOuterMostWorkspaceFolder(folder);

    if (!clients.has(folder.uri.toString())) {
      const debugOptions = {
        execArgv: ["--nolazy", `--inspect=${6011 + clients.size}`],
      };
      const serverOptions = {
        run: { module: modulePath, transport: TransportKind.ipc },
        debug: {
          module: modulePath,
          transport: TransportKind.ipc,
          options: debugOptions,
        },
      };
      // client extensions configure their server
      const documentSelector = [
        { language: "plaintext", scheme: "file" },
        { language: "yaml", scheme: "file" },
        { language: "restructuredtext", scheme: "file" },
        { language: "toml", scheme: "file" },
      ];
      const clientOptions: LanguageClientOptions = {
        documentSelector,
        diagnosticCollectionName: "snooty-spigot",
        workspaceFolder: folder,
        outputChannel,
      };
      const client = new LanguageClient(
        "snooty-spigot",
        "Snooty Spigot",
        serverOptions,
        clientOptions
      );
      client.start();
      clients.set(folder.uri.toString(), client);
    }
  }

  Workspace.onDidOpenTextDocument(didOpenTextDocument);
  Workspace.textDocuments.forEach(didOpenTextDocument);
  Workspace.onDidChangeWorkspaceFolders((event) => {
    for (const folder of event.removed) {
      const client = clients.get(folder.uri.toString());
      if (client) {
        clients.delete(folder.uri.toString());
        client.stop();
      }
    }
  });
}

export function deactivate(): Thenable<void> {
  isActive = false;
  const promises: Thenable<void>[] = [];
  for (const client of clients.values()) {
    promises.push(client.stop());
  }
  return Promise.all(promises).then(() => undefined);
}
