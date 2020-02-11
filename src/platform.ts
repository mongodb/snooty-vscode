/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as util from './common';

export class PlatformInformation {
    public constructor(
        public platform: string,
        public architecture: string)
    {
    }

    public toString(): string {
        let result = this.platform;

        if (this.architecture) {
            if (result) {
                result += ', ';
            }

            result += this.architecture;
        }

        return result;
    }

    public static GetCurrent(): Promise<PlatformInformation> {
        let platform = os.platform();
        let architecturePromise: Promise<string>;

        switch (platform) {
            case 'win32':
                architecturePromise = PlatformInformation.GetWindowsArchitecture();
                break;

            case 'darwin':
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                break;

            case 'linux':
                architecturePromise = PlatformInformation.GetUnixArchitecture();
                break;

            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }

        return Promise.all<any>([architecturePromise])
            .then(([arch]) => {
                return new PlatformInformation(platform, arch);
            });
    }

    private static GetWindowsArchitecture(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (process.env.PROCESSOR_ARCHITECTURE === 'x86' && process.env.PROCESSOR_ARCHITEW6432 === undefined) {
                resolve('x86');
            }
            else {
                resolve('x86_64');
            }
        });
    }

    private static async GetUnixArchitecture(): Promise<string> {
        const architecture = await util.execChildProcess('uname -m');
        if (architecture) {
            return architecture.trim();
        }

        return "unknown";
    }
}
