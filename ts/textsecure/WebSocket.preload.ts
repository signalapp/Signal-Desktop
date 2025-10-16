// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import ws from 'websocket';
import type { connection as WebSocket } from 'websocket';
import type { IncomingMessage } from 'node:http';

import { AbortableProcess } from '../util/AbortableProcess.std.js';
import { strictAssert } from '../util/assert.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { getUserAgent } from '../util/getUserAgent.node.js';
import * as durations from '../util/durations/index.std.js';
import type { ProxyAgent } from '../util/createProxyAgent.node.js';
import { createHTTPSAgent } from '../util/createHTTPSAgent.node.js';
import { HTTPError } from '../types/HTTPError.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Timers from '../Timers.preload.js';
import { ConnectTimeoutError } from './Errors.std.js';
import { handleStatusCode, translateError } from './Utils.dom.js';

const { client: WebSocketClient } = ws;

const log = createLogger('WebSocket');

const TEN_SECONDS = 10 * durations.SECOND;
const WEBSOCKET_CONNECT_TIMEOUT = TEN_SECONDS;
const KEEPALIVE_INTERVAL_MS = TEN_SECONDS;

export type IResource = {
  close(code: number, reason: string): void;
};

export type ConnectOptionsType<Resource extends IResource> = Readonly<{
  name: string;
  url: string;
  certificateAuthority?: string;
  version: string;
  proxyAgent?: ProxyAgent;
  timeout?: number;
  extraHeaders?: Record<string, string>;
  onUpgradeResponse?: (response: IncomingMessage) => void;

  createResource(socket: WebSocket): Resource;
}>;

export function connect<Resource extends IResource>({
  name,
  url,
  certificateAuthority,
  version,
  proxyAgent,
  extraHeaders = {},
  timeout = WEBSOCKET_CONNECT_TIMEOUT,
  onUpgradeResponse,
  createResource,
}: ConnectOptionsType<Resource>): AbortableProcess<Resource> {
  const fixedScheme = url
    .replace('https://', 'wss://')
    .replace('http://', 'ws://');

  const headers = {
    ...extraHeaders,
    'User-Agent': getUserAgent(version),
  };
  const client = new WebSocketClient({
    tlsOptions: {
      ca: certificateAuthority,
      agent: proxyAgent ?? createHTTPSAgent(),
    },
    maxReceivedFrameSize: 0x210000,
  });

  client.connect(fixedScheme, undefined, undefined, headers);

  const { stack } = new Error();

  const { promise, resolve, reject } = explodePromise<Resource>();

  const timer = Timers.setTimeout(() => {
    reject(new ConnectTimeoutError('Connection timed out'));

    client.abort();
  }, timeout);

  let resource: Resource | undefined;
  client.on('connect', socket => {
    Timers.clearTimeout(timer);

    socket.socket.setKeepAlive(true, KEEPALIVE_INTERVAL_MS);

    resource = createResource(socket);
    resolve(resource);
  });

  client.on('upgradeResponse', response => {
    onUpgradeResponse?.(response);
  });

  client.on('httpResponse', async response => {
    Timers.clearTimeout(timer);

    const statusCode = response.statusCode || -1;
    await handleStatusCode(statusCode);

    const error = new HTTPError('connectResource: invalid websocket response', {
      code: statusCode || -1,
      headers: {},
      stack,
    });

    const translatedError = translateError(error);
    strictAssert(
      translatedError,
      '`httpResponse` event cannot be emitted with 200 status code'
    );

    reject(translatedError);
  });

  client.on('connectFailed', originalErr => {
    Timers.clearTimeout(timer);

    const err = new HTTPError('connectResource: connectFailed', {
      code: -1,
      headers: {},
      stack,
      cause: originalErr,
    });
    reject(err);
  });

  return new AbortableProcess<Resource>(
    `WebSocket.connect(${name})`,
    {
      abort() {
        if (resource) {
          log.warn(`closing socket ${name}`);
          resource.close(3000, 'aborted');
        } else {
          log.warn(`aborting connection ${name}`);
          Timers.clearTimeout(timer);
          client.abort();
        }
      },
    },
    promise
  );
}
