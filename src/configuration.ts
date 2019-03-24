'use strict';

import { workspace, WorkspaceConfiguration } from 'vscode';

export class SnootyConfiguration {

    public get logToFile(): boolean {
        return this.configuration.get<boolean>('snooty.logToFile', false);
    }

    /**
     * If specified, RLS will be spawned by executing a file at the given path.
     */
    public get languageServerPath(): string | null {
        return this.configuration.get('snooty.languageServerPath', null);
    }

    private readonly configuration: WorkspaceConfiguration;
    private readonly wsPath: string;

    private constructor(configuration: WorkspaceConfiguration, wsPath: string) {
        this.configuration = configuration;
        this.wsPath = wsPath;
    }
}
