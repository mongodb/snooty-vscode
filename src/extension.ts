'use strict';

import * as fs from "fs";
import * as vscode from "vscode";
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions, CancellationToken } from 'vscode-languageclient';
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

    // Command for getting page ast
    const getPageAST: vscode.Disposable = vscode.commands.registerCommand('snooty.getPageAST', async () => {
        const textDocument: vscode.TextDocument = vscode.window.activeTextEditor.document;
        const fileName: string = textDocument.fileName;
        
        // Only valid on .txt site pages
        if (!fileName.endsWith(".txt")) {
            const errorMsg = "ERROR: This command can only be performed on .txt files."
            vscode.window.showErrorMessage(errorMsg);
        }
        else {
            const fileText: string = textDocument.getText();
            await client.sendRequest("textDocument/get_page_ast", {filePath: fileName, fileText: fileText}).then((ast: any) => {
                console.log(ast);
            });
        }
    });

    context.subscriptions.push(getPageAST);

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
            const wordRegex = /\/\S+/;
            const wordRange = _document.getWordRangeAtPosition(_position, wordRegex);

            if (wordRange != undefined) {
                // Get text at that range
                const word = _document.getText(wordRange);

                // Request hover information using the snooty-parser server
                let request = async () => {
                    let contents: vscode.MarkdownString;

                    await client.sendRequest("textDocument/resolve", {fileName: word, docPath: _document.uri.path, resolveType: "directive"}).then((file: string) => {
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

    vscode.languages.registerDocumentLinkProvider(
        clientOptions.documentSelector, 
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

class DocumentLinkProvider implements vscode.DocumentLinkProvider {
    private _client: LanguageClient;

    constructor(client: LanguageClient) {
        this._client = client;
    }

    // Provides the text document with the ranges for document links
    provideDocumentLinks(document: vscode.TextDocument, token: CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
        return this._findDocLinks(document);
    }

    // Adds the target uri to the document link
    async resolveDocumentLink(link: vscode.DocumentLink, token: CancellationToken): Promise<vscode.DocumentLink> {
        const document = vscode.window.activeTextEditor.document;
        const text = document.getText(link.range);
        link.target = await this._findTargetUri(document, text);
        return link;
    }

    // Returns document links found within the current text document
    private _findDocLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        const docText = document.getText();
        const docRoles = docText.match(/:doc:`.+?`/gs);

        if (docRoles === null) return [];

        let doclinks: vscode.DocumentLink[] = [];
        let docRoleOffsetStart = -1; // Initiated to -1 to accommodate 0th index

        // For every doc role found, find their respective target
        for (const docRole of docRoles) {
            docRoleOffsetStart = docText.indexOf(docRole, docRoleOffsetStart + 1);

            // Find target in doc role
            // Check if target exists in the form :doc:`text <target-name>`
            let targetMatches = docRole.match(/(?<=<)\S+(?=>)/);
            // If target not found, target should exist in the form :doc:`target-name`
            if (targetMatches === null) {
                targetMatches = docRole.match(/(?<=`)\S+(?=`)/);
            }
            const target = targetMatches[0];
            const targetIndex = docRole.indexOf(target);

            // Get range of the target within the scope of the whole text document
            const targetOffsetStart = docRoleOffsetStart + targetIndex;
            const targetOffsetEnd = targetOffsetStart + target.length;

            doclinks.push({
                range: new vscode.Range(
                    document.positionAt(targetOffsetStart), 
                    document.positionAt(targetOffsetEnd)
                )
            });
        }

        return doclinks;
    }

    // Returns the full uri given a target's name
    private async _findTargetUri(document: vscode.TextDocument, target: string): Promise<vscode.Uri> {
        return await this._client.sendRequest(
            "textDocument/resolve", 
            {fileName: target, docPath: document.uri.path, resolveType: "doc"}).then((file: string) => {
                return vscode.Uri.file(file);
        });
    }
}