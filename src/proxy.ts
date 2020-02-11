/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Url, parse as parseUrl } from 'url';
import HttpsProxyAgent = require('https-proxy-agent');

function getSystemProxyURL(requestURL: Url): string | undefined {
    if (requestURL.protocol === 'https:') {
        return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || undefined;
    }
}

export function getProxyAgent(requestURL: Url, proxy?: string): HttpsProxyAgent | undefined {
    const proxyURL = proxy || getSystemProxyURL(requestURL);

    if (!proxyURL) {
        return undefined;
    }

    const proxyEndpoint = parseUrl(proxyURL);

    if (!/^https?:$/.test(proxyEndpoint.protocol || "")) {
        return undefined;
    }

    const opts = {
        host: proxyEndpoint.hostname || "",
        port: Number(proxyEndpoint.port),
        auth: proxyEndpoint.auth,
        rejectUnauthorized: true
    };

    return new HttpsProxyAgent(opts);
}
