// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Agent as HTTPSAgent } from 'https';
import type { AgentOptions, RequestOptions } from 'https';
import type { LookupAddress } from 'dns';
import type net from 'net';
import tls from 'tls';
import type { ConnectionOptions } from 'tls';
import { callbackify, promisify } from 'util';
import pTimeout from 'p-timeout';

import * as log from '../logging/log';
import {
  electronLookup as electronLookupWithCb,
  interleaveAddresses,
} from './dns';
import { strictAssert } from './assert';
import { parseIntOrThrow } from './parseIntOrThrow';
import { sleep } from './sleep';
import { SECOND } from './durations';
import { dropNull } from './dropNull';
import { explodePromise } from './explodePromise';

// https://www.rfc-editor.org/rfc/rfc8305#section-8 recommends 250ms, but since
// we also try to establish a TLS session - use higher value.
const DELAY_MS = 500;

// Warning threshold
const CONNECT_THRESHOLD_MS = SECOND;

const CONNECT_TIMEOUT_MS = 10 * SECOND;

const electronLookup = promisify(electronLookupWithCb);

const HOST_LOG_ALLOWLIST = new Set([
  // Production
  'chat.signal.org',
  'storage.signal.org',
  'cdsi.signal.org',
  'cdn.signal.org',
  'cdn2.signal.org',
  'cdn3.signal.org',

  // Staging
  'chat.staging.signal.org',
  'storage-staging.signal.org',
  'cdsi.staging.signal.org',
  'cdn-staging.signal.org',
  'cdn2-staging.signal.org',
  'create.staging.signal.art',

  // Common
  'updates2.signal.org',
  'sfu.voip.signal.org',
]);

export class Agent extends HTTPSAgent {
  constructor(options: AgentOptions = {}) {
    super({
      ...options,
      lookup: electronLookup,
    });
  }

  public createConnection = callbackify(
    async (options: RequestOptions): Promise<net.Socket> => {
      const { host = options.hostname, port: portString } = options;
      strictAssert(host, 'Agent.createConnection: Missing options.host');
      strictAssert(portString, 'Agent.createConnection: Missing options.port');

      const port = parseIntOrThrow(
        portString,
        'Agent.createConnection: options.port is not an integer'
      );

      const addresses = await electronLookup(host, { all: true });

      const start = Date.now();

      const { socket, address, v4Attempts, v6Attempts } = await happyEyeballs({
        addresses,
        port,
        tlsOptions: {
          ca: options.ca,
          servername: options.servername ?? dropNull(options.host),
        },
      });

      if (HOST_LOG_ALLOWLIST.has(host)) {
        const duration = Date.now() - start;
        const logLine =
          `createHTTPSAgent.createConnection(${host}): connected to ` +
          `IPv${address.family} addr after ${duration}ms ` +
          `(attempts v4=${v4Attempts} v6=${v6Attempts})`;

        if (v4Attempts + v6Attempts > 1 || duration > CONNECT_THRESHOLD_MS) {
          log.warn(logLine);
        } else {
          log.info(logLine);
        }
      }

      return socket;
    }
  );
}

export type HappyEyeballsOptions = Readonly<{
  addresses: ReadonlyArray<LookupAddress>;
  port?: number;
  connect?: typeof defaultConnect;
  tlsOptions?: ConnectionOptions;
}>;

export type HappyEyeballsResult = Readonly<{
  socket: net.Socket;
  address: LookupAddress;
  v4Attempts: number;
  v6Attempts: number;
}>;

export async function happyEyeballs({
  addresses,
  port = 443,
  tlsOptions,
  connect = defaultConnect,
}: HappyEyeballsOptions): Promise<HappyEyeballsResult> {
  let v4Attempts = 0;
  let v6Attempts = 0;

  const interleaved = interleaveAddresses(addresses);
  const abortControllers = interleaved.map(() => new AbortController());

  const results = await Promise.allSettled(
    interleaved.map(async (addr, index) => {
      const abortController = abortControllers[index];
      if (index !== 0) {
        await sleep(index * DELAY_MS, abortController.signal);
      }

      if (addr.family === 4) {
        v4Attempts += 1;
      } else {
        v6Attempts += 1;
      }

      let socket: net.Socket;
      try {
        socket = await pTimeout(
          connect({
            address: addr.address,
            port,
            tlsOptions,
            abortSignal: abortController.signal,
          }),
          CONNECT_TIMEOUT_MS,
          'createHTTPSAgent.connect: connection timed out'
        );
      } catch (error) {
        abortController.abort();
        throw error;
      }

      if (abortController.signal.aborted) {
        throw new Error('Aborted');
      }

      // Abort other connection attempts
      for (const otherController of abortControllers) {
        if (otherController !== abortController) {
          otherController.abort();
        }
      }
      return { socket, abortController, index };
    })
  );

  const fulfilled = results.find(({ status }) => status === 'fulfilled');
  if (fulfilled) {
    strictAssert(
      fulfilled.status === 'fulfilled',
      'Fulfilled promise was not fulfilled'
    );
    const { socket, index } = fulfilled.value;

    return {
      socket,
      address: interleaved[index],
      v4Attempts,
      v6Attempts,
    };
  }

  strictAssert(
    results[0].status === 'rejected',
    'No fulfilled promises, but no rejected either'
  );

  // Abort all connection attempts for consistency
  for (const controller of abortControllers) {
    controller.abort();
  }
  throw results[0].reason;
}

export type ConnectOptionsType = Readonly<{
  port: number;
  address: string;
  tlsOptions?: ConnectionOptions;
  abortSignal?: AbortSignal;
}>;

async function defaultConnect({
  port,
  address,
  tlsOptions,
  abortSignal,
}: ConnectOptionsType): Promise<net.Socket> {
  const socket = tls.connect(port, address, {
    ...tlsOptions,
  });
  abortSignal?.addEventListener('abort', () =>
    socket.destroy(new Error('Aborted'))
  );

  const { promise: onHandshake, resolve, reject } = explodePromise<void>();

  socket.once('secureConnect', resolve);
  socket.once('error', reject);

  try {
    await onHandshake;
  } finally {
    socket.removeListener('secureConnect', resolve);
    socket.removeListener('error', reject);
  }

  return socket;
}

export function createHTTPSAgent(options: AgentOptions = {}): Agent {
  return new Agent(options);
}
