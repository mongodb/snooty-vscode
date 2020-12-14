'use strict';

import * as vscode from "vscode";
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import * as mime from "mime";
import * as open from "open";
import { Logger } from "./logger";
import { DocumentLinkProvider } from "./docLinkProvider";
import { exec, ExecException } from 'child_process';

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
    logger = new Logger(text => getOutputChannel().append(text));

    const extension = vscode.extensions.all.find(ext => ext.extensionUri === context.extensionUri);
    if (!extension) {
        logger.appendLine("Failed to initialize: vscode did not report this extension as being installed")
        return;
    }

    // check if the path is overridden.
    let executableCommand: string | undefined = vscode.workspace.getConfiguration('snooty')
        .get('languageServerPath', undefined);
    let args: string[] = [];
    if (executableCommand) {
        args.push('language-server');
    } else {
        logger.appendLine('Could not find executable configured in snooty.languageServerPath. Try snooty package for Python');
        // load Python package.
        const defaultPythonCommand = 'python';
        try {
            const extension = vscode.extensions.getExtension('ms-python.python');
            if (!extension) {
                executableCommand = defaultPythonCommand;
            } else {
                const usingNewInterpreterStorage = extension.packageJSON?.featureFlags?.usingNewInterpreterStorage;
                if (usingNewInterpreterStorage) {
                    if (!extension.isActive) {
                        await extension.activate();
                    }
                    executableCommand = extension.exports.settings.getExecutionDetails().execCommand[0];
                } else {
                    executableCommand = vscode.workspace.getConfiguration('python').get<string>('pythonPath', '');
                }
            }
        } catch (error) {
            executableCommand = defaultPythonCommand;
        }

        if (!(await checkSnootyInstall(executableCommand))) {
            logger.appendLine('snooty package for Python is not installed');
            var choice = await vscode.window.showInformationMessage('Language server snooty is not installed.', 'Install', 'Not now');
            if (choice === 'Install') {
                logger.appendLine('Started to install snooty...');
                await installSnooty(executableCommand);
            } else {
                vscode.window.showWarningMessage('No IntelliSense. Language server snooty is not installed.');
                logger.appendLine('User decided to exit');
                return;
            }
        }
        args.push('-m', 'snooty', 'language-server');
    }

    if (!executableCommand) {
        logger.append('Could not find executable');
        return;
    }

    const run: Executable = {
        args: args,
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
    };

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

function execCommand(pythonPath: string, ...args: string[]): Promise<string> {
    const cmd = [pythonPath, ...args];
    return new Promise<string>((resolve, reject) => {
        exec(
            cmd.join(' '),
            (error: ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    let errorMessage: string = [
                        error.name,
                        error.message,
                        error.stack,
                        '',
                        stderr.toString()
                    ].join('\n');
                    reject(errorMessage);
                } else {
                    resolve(stdout.toString());
                }
            }
        );
    });
}

async function checkSnootyInstall(pythonPath: string | undefined): Promise<boolean> {
    if (!pythonPath) {
        return false;
    }
    try {
        await execCommand(pythonPath, '-c', '"import snooty;"');
        return true;
    } catch (e) {
        return false;
    }
}

async function installSnooty(pythonPath: string | undefined): Promise<void> {
    if (!pythonPath) {
        return;
    }
    try {
        await execCommand(pythonPath, '-m', 'pip', 'install', 'snooty');
    } catch (e) {
        vscode.window.showErrorMessage(
            'Could not install snooty. Please run `pip install snooty` to use this ' +
            'extension, or check your Python path.'
        );
    }
}
