import { workspace, ExtensionContext } from 'vscode';
import { ServerOptions, Executable, LanguageClient, LanguageClientOptions } from 'vscode-languageclient';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
    // Load the path to the language server from settings
    const executableCommand = workspace.getConfiguration('snooty')
        .get('languageServerPath', 'snooty');

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
            { language: 'rst', scheme: 'file' },
        ],
        synchronize: {
            configurationSection: 'snooty',
            fileEvents: [
                workspace.createFileSystemWatcher('**/*.rst'),
                workspace.createFileSystemWatcher('**/*.txt'),
                workspace.createFileSystemWatcher('**/*.yaml'),
                workspace.createFileSystemWatcher('snooty.toml')
            ]
        }
    }

    const client = new LanguageClient('Snooty', serverOptions, clientOptions);

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(client.start());
}

// this method is called when your extension is deactivated
export function deactivate() {
}
