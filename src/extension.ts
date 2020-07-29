'use strict';

import * as fs from "fs";
import * as vscode from "vscode";
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import * as mime from "mime";
import * as open from "open";
import { Logger } from "./logger";
import * as util from './common';
import { ExtensionDownloader } from "./ExtensionDownloader";
import { DocumentLinkProvider } from "./docLinkProvider";

const EXTENSION_ID = 'i80and.snooty';
let logger: Logger | undefined;

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Snooty Extension');
	}
	return _channel;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (!extension) {
        return;
    }

    util.setExtensionPath(extension.extensionPath);
    logger = new Logger(text => getOutputChannel().append(text));
    await ensureRuntimeDependencies(extension, logger);

    let executableCommand: string | undefined = vscode.workspace.getConfiguration('snooty')
        .get('languageServerPath', undefined);

    if (!executableCommand) {
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
    const documentSelector = [
        { language: 'plaintext', scheme: 'file' },
        { language: 'yaml', scheme: 'file' },
        { language: 'restructuredtext', scheme: 'file' },
        { language: 'toml', scheme: 'file' },
    ];
    const clientOptions: LanguageClientOptions = {
        documentSelector,
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

    const client = new LanguageClient('Snooty Language Client', serverOptions, clientOptions);
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
    const clickInclude: vscode.Disposable = vscode.commands.registerCommand('snooty.clickInclude', async () => {
        // Send request to server (snooty-parser)
        const type = mime.getType(hoverFile);

        if (type == null || !type.includes("image")) {
            const textDoc = await vscode.workspace.openTextDocument(hoverFile);
            vscode.window.showTextDocument(textDoc);
        }
        else {
            open(hoverFile);
        }
    });
    context.subscriptions.push(clickInclude);

    // Shows clickable link to file after hovering over it
    vscode.languages.registerHoverProvider(
        documentSelector,
        new class implements vscode.HoverProvider {
          provideHover(
            _document: vscode.TextDocument,
            _position: vscode.Position,
            _token: vscode.CancellationToken
          ): vscode.ProviderResult<vscode.Hover> {
            // Get range for a link
            const wordRegex = /\/\S+/;
            const wordRange = _document.getWordRangeAtPosition(_position, wordRegex);

            if (wordRange != undefined) {
                // Get text at that range
                const word = _document.getText(wordRange);

                // Request hover information using the snooty-parser server
                let request = async () => {
                    let contents: vscode.MarkdownString;

                    const file: string = await client.sendRequest("textDocument/resolve", {fileName: word, docPath: _document.uri.path, resolveType: "directive"});
                    const command = vscode.Uri.parse(`command:snooty.clickInclude`);

                    // Clean up absolute path for better UX. str.match() was not working with regex but can look into later
                    let workspaceFolder = vscode.workspace.name;
                    if (!workspaceFolder) {
                        return;
                    }
                    let folderIndex = file.search(workspaceFolder);
                    let hoverPathRelative = file.slice(folderIndex);

                    contents = new vscode.MarkdownString(`[${hoverPathRelative}](${command})`);
                    contents.isTrusted = true; // Enables commands to be used

                    return new vscode.Hover(contents, wordRange);
                }

                return request();
            }
          }
        } ()
    );

    vscode.languages.registerDocumentLinkProvider(
        documentSelector,
        new DocumentLinkProvider(client)
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
