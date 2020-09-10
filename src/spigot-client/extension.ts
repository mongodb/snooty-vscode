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
  DidChangeConfigurationNotification,
  DidChangeConfigurationParams,
} from "vscode-languageclient";

const SNOOTY_SPIGOT_CONFIGURATION = "snooty.spigot";

let clients: Map<string, LanguageClient> = new Map();

interface State {
  shutdownPromise: Promise<void> | null;
  isActive: boolean;
}
const state: State = {
  shutdownPromise: null,
  isActive: false,
};

let sourceRelativePath = "source/";
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
  return Workspace.getConfiguration(SNOOTY_SPIGOT_CONFIGURATION).get<boolean>(
    "enabled"
  );
}

function getSourceRelativePath(): string {
  return Workspace.getConfiguration(SNOOTY_SPIGOT_CONFIGURATION).get<string>(
    "sourceRelativePath"
  );
}

function sendSourceRelativePathNotifications() {
  // For some reason, this is not automatically firing when
  // workspace configuration changes, unless I'm missing something...
  clients.forEach((client) => {
    const params: DidChangeConfigurationParams = {
      settings: {
        snooty: {
          spigot: {
            sourceRelativePath,
          },
        },
      },
    };
    client.sendNotification(DidChangeConfigurationNotification.type, params);
  });
}

Workspace.onDidChangeConfiguration((e) => {
  if (!e.affectsConfiguration(SNOOTY_SPIGOT_CONFIGURATION)) {
    return;
  }

  const enabled = isEnabled();
  if (enabled && !state.isActive) {
    continueActivation();
  } else if (!enabled && state.isActive) {
    outputChannel.appendLine("Snooty Spigot hibernating...");
    deactivate();
  }

  const newSourceRelativePath = getSourceRelativePath();

  if (newSourceRelativePath === sourceRelativePath) {
    return;
  }

  sourceRelativePath = newSourceRelativePath;
  sendSourceRelativePathNotifications();
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
    outputChannel.appendLine("Snooty Spigot is not enabled. Hibernating...");
    return;
  }

  function didOpenTextDocument(document: TextDocument): void {
    if (!state.isActive) {
      return;
    }
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
        initializationOptions: {
          sourceRelativePath: getSourceRelativePath(),
        },
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
  continueActivation();
}

function continueActivation() {
  outputChannel.appendLine("Activating Snooty Spigot...");
  if (state.shutdownPromise) {
    // Come back later.
    outputChannel.appendLine("Snooty Spigot rebooting...");
    return state.shutdownPromise.then(continueActivation);
  }
  if (state.isActive) {
    return;
  }
  state.isActive = true;
  outputChannel.appendLine("Snooty Spigot activated.");
}

export function deactivate(): Thenable<void> {
  outputChannel.appendLine("Deactivating Snooty Spigot...");
  if (state.shutdownPromise) {
    return;
  }
  state.shutdownPromise = new Promise((resolve, reject) => {
    const promises: Thenable<void>[] = [];
    for (const client of clients.values()) {
      promises.push(client.stop());
    }
    Promise.all(promises)
      .then(() => {
        outputChannel.appendLine("Snooty Spigot shut down complete.");
        clients.clear();
        state.shutdownPromise = null;
        state.isActive = false;
        resolve();
      })
      .catch((error) => {
        outputChannel.appendLine(`Snooty Spigot shut down failed: ${error}`);
        console.error(error);
        state.shutdownPromise = null;
        state.isActive = false;
        reject(error);
      });
  });
}
