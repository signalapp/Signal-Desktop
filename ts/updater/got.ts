// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StrictOptions as GotOptions } from 'got';
import config from 'config';
import ProxyAgent from 'proxy-agent';

import * as packageJson from '../../package.json';
import { getUserAgent } from '../util/getUserAgent';
import * as durations from '../util/durations';

export const GOT_CONNECT_TIMEOUT = 5 * durations.MINUTE;
export const GOT_LOOKUP_TIMEOUT = 5 * durations.MINUTE;
export const GOT_SOCKET_TIMEOUT = 5 * durations.MINUTE;

export function getProxyUrl(): string | undefined {
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}

export function getCertificateAuthority(): string {
  return config.get('certificateAuthority');
}

export function getGotOptions(): GotOptions {
  const certificateAuthority = getCertificateAuthority();
  const proxyUrl = getProxyUrl();
  const agent = proxyUrl
    ? {
        http: new ProxyAgent(proxyUrl),
        https: new ProxyAgent(proxyUrl),
      }
    : undefined;

  return {
    agent,
    https: {
      certificateAuthority,
    },
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': getUserAgent(packageJson.version),
    },
    timeout: {
      connect: GOT_CONNECT_TIMEOUT,
      lookup: GOT_LOOKUP_TIMEOUT,

      // This timeout is reset whenever we get new data on the socket
      socket: GOT_SOCKET_TIMEOUT,
    },
  };
}
