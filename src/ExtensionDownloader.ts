/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager, Status, PackageError } from './packages';
import { PlatformInformation } from './platform';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class ExtensionDownloader
{
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private packageJSON: any) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.logger.append('Installing reStructuredText dependencies...');
        this.channel.show();

        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        let installationStage = 'touchBeginFile';

        const status: Status = {
            setMessage: text => {
                statusItem.text = text;
                statusItem.show();
            },
            setDetail: text => {
                statusItem.tooltip = text;
                statusItem.show();
            }
        };

        let errorMessage = '';
        let success = false;

        try {
            await util.touchInstallFile(util.InstallFileType.Begin);
            installationStage = 'getPlatformInfo';
            const platformInfo = await PlatformInformation.GetCurrent();
            const packageManager = new PackageManager(platformInfo, this.packageJSON);
            this.logger.appendLine();

            // Display platform information and RID followed by a blank line
            this.logger.appendLine(`Platform: ${platformInfo.toString()}`);
            this.logger.appendLine();

            installationStage = 'ensureLatestParserVersion';
            await packageManager.getLatestParserUrl(platformInfo.platform, this.logger);
            const installedParserVersion = readParserVersionFromFile(this.logger);

            const fileExists = installedParserVersion === packageManager.parserVersion;
            if (fileExists) {
                installationStage = 'completeSuccess';
                success = true;
                return success;
            }
            this.logger.appendLine('New snooty-parser version available.')

            installationStage = 'downloadPackages';

            const config = vscode.workspace.getConfiguration();
            const proxy = config.get<string>('http.proxy');

            await packageManager.DownloadPackages(this.logger, status, proxy);
            this.logger.appendLine();

            installationStage = 'installPackages';
            await packageManager.InstallPackages(this.logger, status);

            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);

            installationStage = 'writeParserVersionToTxtFile';
            packageManager.writeParserVersionToFile();

            installationStage = 'completeSuccess';
            success = true;
        }
        catch (error) {
            if (error instanceof PackageError) {
                if (error.innerError) {
                    errorMessage = error.innerError.toString();
                } else {
                    errorMessage = error.message;
                }

            } else {
                errorMessage = error.toString();
            }

            await vscode.window.showErrorMessage(`Failed at stage: ${installationStage}:\n\n${errorMessage}`);

            this.logger.appendLine(`Failed at stage: ${installationStage}`);
            this.logger.appendLine(errorMessage);
        }

        this.logger.appendLine();
        installationStage = '';
        this.logger.appendLine('Finished');

        statusItem.dispose();

        // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
        // Attach a an empty catch to this so that errors here do not propogate
        try {
            await util.deleteInstallFile(util.InstallFileType.Begin);
        }
        catch (err) { }

        return success;
    }
}

function readParserVersionFromFile(logger: Logger) {
    const basePath = util.getExtensionPath();
    const absolutePath = path.resolve(basePath, 'parser-version.txt');

    try {
        const data = fs.readFileSync(absolutePath, { encoding: 'utf8' });
        return data;
    } catch (error) {
        logger.appendLine('No parser-version.txt file found.')
        return '';
    }
}