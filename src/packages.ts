/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { promisify }  from 'util';
import * as https from 'https';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as tmp from 'tmp-promise';
import { parse as parseUrl } from 'url';
import * as yauzl from 'yauzl-promise';
import * as util from './common';
import { Logger } from './logger';
import { PlatformInformation } from './platform';
import { getProxyAgent } from './proxy';

// Unix User Executable bitmask
const S_IXUSR = 0o0100;

export interface Package {
    description: string;
    installPath?: string;
    platforms: Record<string, string>;
    tmpFile: tmp.FileResult;

    // Path to use to test if the package has already been installed
    installTestPath?: string;
}

export interface Status {
    setMessage: (text: string) => void;
    setDetail: (text: string) => void;
}

export class PackageError extends Error {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(public message: string,
                public pkg?: Package,
                public innerError?: Error) {
        super(message);
    }
}

export class PackageManager {
    private allPackages: Package[] = []

    public constructor(
        private platformInfo: PlatformInformation,
        private packageJSON: any) {

        this.allPackages = <Package[]>this.packageJSON.runtimeDependencies;

        // Ensure our temp files get cleaned up in case of error.
        tmp.setGracefulCleanup();
    }

    public async DownloadPackages(logger: Logger, status: Status, proxy?: string): Promise<void> {
        const packages = this.allPackages;
        logger.appendLine(`packages: ${JSON.stringify(packages, null, 2)}`);
        for (const pkg of packages) {
            logger.appendLine(`packageTestPathExists: ${await getPackageTestPath(pkg)}`);
            const exists = await doesPackageTestPathExist(pkg);
            logger.appendLine(`exists: ${exists}`)
            if (!exists) {
                return this.downloadPackage(pkg, logger, status, proxy);
            } else {
                logger.appendLine(`Skipping package '${pkg.description}' (already downloaded).`);
            }
        }
    }

    public async InstallPackages(logger: Logger, status: Status): Promise<void> {
        for (const pkg of this.allPackages) {
            await installPackage(pkg, logger, status);
        }
    }

    private async downloadPackage(pkg: Package, logger: Logger, status: Status, proxy?: string): Promise<void> {
        const platformKey = [this.platformInfo.architecture, this.platformInfo.platform].join(" ");
        const url = pkg.platforms[platformKey];


        if (!url) {
            throw new PackageError(`Unsupported platform: '${platformKey}'`, pkg);
        }

        logger.append(`Downloading package '${pkg.description}' `);
        status.setMessage("$(cloud-download) Downloading packages");
        status.setDetail(`Downloading package '${pkg.description}'...`);

        const tmpResult = await tmp.file({ prefix: 'package-' });

        pkg.tmpFile = tmpResult;

        const result = await downloadFile(url, pkg, logger, status, proxy);
        logger.appendLine(' Done!');

        return result;
    }
}

function getBaseInstallPath(pkg: Package): string {
    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.join(basePath, pkg.installPath);
    }

    return basePath;
}

function getNoopStatus(): Status {
    return {
        setMessage: text => { },
        setDetail: text => { }
    };
}

function downloadFile(urlString: string, pkg: Package, logger: Logger, status: Status, proxy?: string): Promise<void> {
    const url = parseUrl(urlString);

    const options: https.RequestOptions = {
        host: url.host,
        path: url.path,
        agent: getProxyAgent(url, proxy),
        rejectUnauthorized: true
    };

    return new Promise<void>((resolve, reject) => {
        if (!pkg.tmpFile || pkg.tmpFile.fd == 0) {
            return reject(new PackageError("Temporary package file unavailable", pkg));
        }

        const request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                const newLocation = response.headers.location;
                if (newLocation) {
                    return resolve(downloadFile(newLocation, pkg, logger, status, proxy));
                }

                reject(new PackageError("Error getting download location", pkg));
            }

            if (response.statusCode != 200) {
                // Download failed - print error message
                logger.appendLine(`failed (error code '${response.statusCode}')`);
                return reject(new PackageError((response.statusCode || "<missing>").toString(), pkg));
            }

            // Downloading - hook up events
            const packageSize = parseInt(response.headers['content-length'] || "0", 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;
            let dots = 0;
            let tmpFile = fs.createWriteStream(pkg.tmpFile.path, { fd: pkg.tmpFile.fd });

            logger.append(`(${Math.ceil(packageSize / 1024)} KB) `);

            response.on('data', data => {
                downloadedBytes += data.length;

                // Update status bar item with percentage
                let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    status.setDetail(`Downloading package '${pkg.description}'... ${downloadPercentage}%`);
                    downloadPercentage = newPercentage;
                }

                // Update dots after package name in output console
                let newDots = Math.ceil(downloadPercentage / 5);
                if (newDots > dots) {
                    logger.append('.'.repeat(newDots - dots));
                    dots = newDots;
                }
            });

            response.on('end', () => {
                resolve();
            });

            response.on('error', err => {
                reject(new PackageError(`Reponse error: ${err.message || 'NONE'}`, pkg, err));
            });

            // Begin piping data from the response to the package file
            response.pipe(tmpFile);
        });

        request.on('error', err => {
            reject(new PackageError(`Request error: ${err.message || 'NONE'}`, pkg, err));
        });

        // Execute the request
        request.end();
    });
}

async function installPackage(pkg: Package, logger: Logger, status?: Status): Promise<void> {
    if (!pkg.tmpFile) {
        // Download of this package was skipped, so there is nothing to install
        throw new PackageError("No tmpfile", pkg);
    }

    status = status || getNoopStatus();

    logger.appendLine(`Installing package '${pkg.description}'`);
    status.setMessage("$(desktop-download) Installing packages...");
    status.setDetail(`Installing package '${pkg.description}'`);

    let zipFile: yauzl.ZipFile | undefined

    try {
        if (pkg.tmpFile.fd == 0) {
            throw new PackageError('Downloaded file unavailable', pkg);
        }

        try {
            zipFile = await yauzl.open(pkg.tmpFile.path, { lazyEntries: true });
        }
        catch (err) {
            throw new PackageError('Immediate zip file error', pkg, err);
        }

        await zipFile.walkEntries(async (entry) => {
            const absoluteEntryPath = path.resolve(getBaseInstallPath(pkg), entry.fileName);

            if (entry.fileName.endsWith('/')) {
                // Directory - create it
                await mkdirp(absoluteEntryPath, { mode: 0o755 });
                return;
            }
            else {
                // File - extract it
                const readStream = await entry.openReadStream();

                await mkdirp(path.dirname(absoluteEntryPath), { mode: 0o775 });

                // Make sure executable files have correct permissions when extracted
                const mode = entry.externalFileAttributes >>> 16;
                const fileMode = (mode & S_IXUSR) ? 0o755 : 0o664;

                const writeStream = fs.createWriteStream(absoluteEntryPath, { mode: fileMode });
                readStream.pipe(writeStream);
                await (new Promise((resolve, reject) => {
                    readStream.on('end', resolve);
                    readStream.on('error', reject);
                }));
            }
        });
    }
    catch(err) {
        // If anything goes wrong with unzip, make sure we delete the test path (if there is one)
        // so we will retry again later
        const testPath = getPackageTestPath(pkg);
        if (testPath) {
            fs.unlink(testPath, (unlinkError) => console.error(unlinkError));
        }

        throw err;
    } finally {
        if (zipFile !== undefined) {
            await zipFile.close();
        }
    }

    // Clean up temp file
    await pkg.tmpFile.cleanup();
}

function doesPackageTestPathExist(pkg: Package) : Promise<boolean> {
    const testPath = getPackageTestPath(pkg);
    if (testPath) {
        return util.fileExists(testPath);
    } else {
        return Promise.resolve(false);
    }
}

function getPackageTestPath(pkg: Package) : string | undefined {
    if (pkg.installTestPath) {
        return path.join(util.getExtensionPath(), pkg.installTestPath);
    }
}
