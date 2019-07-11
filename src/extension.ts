'use strict';

import * as fs from "fs";
import * as vscode from "vscode";
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions, RequestType, TextDocumentPositionParams, Hover } from 'vscode-languageclient';
import * as mime from "mime";
import * as open from "open";
import { Logger } from "./logger";
import * as util from './common';
import { ExtensionDownloader } from "./ExtensionDownloader";

const EXTENSION_ID = 'i80and.snooty';
let logger: Logger = null;

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Snooty');
	}
	return _channel;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    util.setExtensionPath(extension.extensionPath);
    logger = new Logger(text => getOutputChannel().append(text));
    await ensureRuntimeDependencies(extension, logger);

    let executableCommand = vscode.workspace.getConfiguration('snooty')
        .get('languageServerPath', null);

    if (executableCommand === null) {
        const languageServerPaths = [
            ".snooty/snooty/snooty"
        ]

        for (let p of languageServerPaths) {
            p = context.asAbsolutePath(p);
            if (fs.existsSync(p)) {
                executableCommand = p;
                break;
            }
        }
    }

    if (!executableCommand) {
        logger.append('Could not find executable');
        return;
    }

    const run: Executable = {
        args: ['language-server'],
        command: executableCommand
    };
    const debug: Executable = run;
    const serverOptions: ServerOptions = {
        run: run,
        debug: debug
    };

    // client extensions configure their server
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: 'plaintext', scheme: 'file' },
            { language: 'yaml', scheme: 'file' },
            { language: 'restructuredtext', scheme: 'file' },
            { language: 'toml', scheme: 'file' },
        ],
        synchronize: {
            configurationSection: 'snooty',
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.rst'),
                vscode.workspace.createFileSystemWatcher('**/*.txt'),
                vscode.workspace.createFileSystemWatcher('**/*.yaml'),
                vscode.workspace.createFileSystemWatcher('snooty.toml')
            ]
        }
    }

    const client = new LanguageClient('Snooty', serverOptions, clientOptions);
    const restartServer = vscode.commands.registerCommand('snooty.restart', async () => {
        await client.stop();
        return client.start();
    });

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(client.start());
    context.subscriptions.push(restartServer);

    // Register custom command to allow includes, literalincludes, and figures to be clickable
    let hoverFile: string;
    let clickInclude = vscode.commands.registerCommand('snooty.clickInclude', async () => {
        // Send request to server (snooty-parser)
        let type = mime.getType(hoverFile);

        if (type == null || !type.includes("image")) {
            let textDoc = await vscode.workspace.openTextDocument(hoverFile);
            vscode.window.showTextDocument(textDoc);
        }
        else {
            open(hoverFile);
        }
    });

    context.subscriptions.push(clickInclude);

    // Shows clickable link to file after hovering over it
    vscode.languages.registerHoverProvider(
        clientOptions.documentSelector,
        new class implements vscode.HoverProvider {
          provideHover(
            _document: vscode.TextDocument,
            _position: vscode.Position,
            _token: vscode.CancellationToken
          ): vscode.ProviderResult<vscode.Hover> {
            // Get range for a link
            let wordRegex = /\/\S+/;
            let wordRange = _document.getWordRangeAtPosition(_position, wordRegex);

            if (wordRange != undefined) {
                // Get text at that range
                let word = _document.getText(wordRange);

                // Request hover information using the snooty-parser server
                let request = async () => {
                    let contents: vscode.MarkdownString;

                    await client.sendRequest("textDocument/resolve", {path: word}).then((file: string) => {
                        hoverFile = file;
                        const command = vscode.Uri.parse(`command:snooty.clickInclude`);

                        // Clean up absolute path for better UX. str.match() was not working with regex but can look into later
                        let workspaceFolder = vscode.workspace.name;
                        let folderIndex = hoverFile.search(workspaceFolder);
                        let hoverPathRelative = hoverFile.slice(folderIndex);

                        contents = new vscode.MarkdownString(`[${hoverPathRelative}](${command})`);
                        contents.isTrusted = true; // Enables commands to be used
                    });

                    return new vscode.Hover(contents, wordRange);
                }

                return request();
            }
          }
        } ()
      );
}

// this method is called when your extension is deactivated
export function deactivate() {
}

async function ensureRuntimeDependencies(extension: vscode.Extension<object>, logger: Logger): Promise<boolean> {
    const exists = await util.installFileExists(util.InstallFileType.Lock);
    if (!exists) {
        const downloader = new ExtensionDownloader(getOutputChannel(), logger, extension.packageJSON);
        return downloader.installRuntimeDependencies();
    } else {
        return true;
    }
}
