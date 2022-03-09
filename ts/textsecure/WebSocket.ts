// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type ProxyAgent from 'proxy-agent';
import { client as WebSocketClient } from 'websocket';
import type { connection as WebSocket } from 'websocket';

import { AbortableProcess } from '../util/AbortableProcess';
import { strictAssert } from '../util/assert';
import { explodePromise } from '../util/explodePromise';
import { getUserAgent } from '../util/getUserAgent';
import * as durations from '../util/durations';
import * as log from '../logging/log';
import * as Timers from '../Timers';
import { ConnectTimeoutError, HTTPError } from './Errors';
import { handleStatusCode, translateError } from './Utils';

const TEN_SECONDS = 10 * durations.SECOND;

export type IResource = {
  close(code: number, reason: string): void;
};

export type ConnectOptionsType<Resource extends IResource> = Readonly<{
  name: string;
  url: string;
  certificateAuthority: string;
  version: string;
  proxyAgent?: ReturnType<typeof ProxyAgent>;
  timeout?: number;
  extraHeaders?: Record<string, string>;

  createResource(socket: WebSocket): Resource;
}>;

export function connect<Resource extends IResource>({
  name,
  url,
  certificateAuthority,
  version,
  proxyAgent,
  extraHeaders = {},
  timeout = TEN_SECONDS,
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
      agent: proxyAgent,
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

    resource = createResource(socket);
    resolve(resource);
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

  client.on('connectFailed', e => {
    Timers.clearTimeout(timer);

    reject(
      new HTTPError('connectResource: connectFailed', {
        code: -1,
        headers: {},
        response: e.toString(),
        stack,
      })
    );
  });

  return new AbortableProcess<Resource>(
    `WebSocket.connect(${name})`,
    {
      abort() {
        if (resource) {
          log.warn(`WebSocket: closing socket ${name}`);
          resource.close(3000, 'aborted');
        } else {
          log.warn(`WebSocket: aborting connection ${name}`);
          Timers.clearTimeout(timer);
          client.abort();
        }
      },
    },
    promise
  );
}
