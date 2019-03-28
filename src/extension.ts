'use strict';

import * as fs from "fs";
import * as vscode from "vscode";
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';
import { Logger } from "./logger";
import * as util from './common';
import { ExtensionDownloader } from "./ExtensionDownloader";

const EXTENSION_ID = 'i80and.snooty';
let _channel: vscode.OutputChannel = null;
let logger: Logger = null;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    util.setExtensionPath(extension.extensionPath);
    _channel = vscode.window.createOutputChannel("Snooty");
    logger = new Logger(text => _channel.append(text));
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
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function ensureRuntimeDependencies(extension: vscode.Extension<object>, logger: Logger): Promise<boolean> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                const downloader = new ExtensionDownloader(_channel, logger, extension.packageJSON);
                return downloader.installRuntimeDependencies();
            } else {
                return true;
            }
        });
}
