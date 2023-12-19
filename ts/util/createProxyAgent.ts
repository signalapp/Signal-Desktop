// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ProxyAgent } from 'proxy-agent';
import net from 'net';
import { URL } from 'url';
import type { LookupOneOptions, LookupAddress } from 'dns';
import { lookup } from 'dns/promises';

import * as log from '../logging/log';
import { happyEyeballs } from './createHTTPSAgent';
import type { ConnectOptionsType } from './createHTTPSAgent';
import { explodePromise } from './explodePromise';
import { SECOND } from './durations';
import { drop } from './drop';

// Warning threshold
const CONNECT_THRESHOLD_MS = SECOND;

const SOCKS_PROTOCOLS = new Set([
  'socks:',
  'socks4:',
  'socks4a:',
  'socks5:',
  'socks5h:',
]);

export function createProxyAgent(proxyUrl: string): ProxyAgent {
  const { port: portStr, hostname: proxyHost, protocol } = new URL(proxyUrl);
  let defaultPort: number | undefined;
  if (protocol === 'http:') {
    defaultPort = 80;
  } else if (protocol === 'https:') {
    defaultPort = 443;
  } else if (SOCKS_PROTOCOLS.has(protocol)) {
    defaultPort = 1080;
  }
  const port = portStr ? parseInt(portStr, 10) : defaultPort;

  async function happyLookup(
    host: string,
    opts: LookupOneOptions
  ): Promise<LookupAddress> {
    if (opts.all) {
      throw new Error('createProxyAgent: all=true lookup is not supported');
    }

    const addresses = await lookup(host, { all: true });

    // SOCKS 4/5 resolve target host before sending it to the proxy.
    if (host !== proxyHost) {
      const idx = Math.floor(Math.random() * addresses.length);
      return addresses[idx];
    }

    const start = Date.now();

    const { socket, address, v4Attempts, v6Attempts } = await happyEyeballs({
      addresses,
      port,
      connect,
    });

    const duration = Date.now() - start;
    const logLine =
      `createProxyAgent.lookup(${host}): connected to ` +
      `IPv${address.family} addr after ${duration}ms ` +
      `(attempts v4=${v4Attempts} v6=${v6Attempts})`;

    if (v4Attempts + v6Attempts > 1 || duration > CONNECT_THRESHOLD_MS) {
      log.warn(logLine);
    } else {
      log.info(logLine);
    }

    // Sadly we can't return socket to proxy-agent
    socket.destroy();

    return address;
  }

  async function happyLookupWithCallback(
    host: string,
    opts: LookupOneOptions,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string,
      family: number
    ) => void
  ): Promise<void> {
    try {
      const { address, family } = await happyLookup(host, opts);
      callback(null, address, family);
    } catch (error) {
      callback(error, '', -1);
    }
  }

  return new ProxyAgent({
    lookup:
      port !== undefined
        ? (...args) => drop(happyLookupWithCallback(...args))
        : undefined,
    getProxyForUrl() {
      return proxyUrl;
    },
  });
}

async function connect({
  port,
  address,
  abortSignal,
}: ConnectOptionsType): Promise<net.Socket> {
  const socket = net.connect({
    port,
    host: address,
    signal: abortSignal,
  });

  const { promise: onConnect, resolve, reject } = explodePromise<void>();

  socket.once('connect', resolve);
  socket.once('error', reject);

  try {
    await onConnect;
  } finally {
    socket.removeListener('connect', resolve);
    socket.removeListener('error', reject);
  }

  return socket;
}
