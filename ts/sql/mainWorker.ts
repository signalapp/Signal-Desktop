// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parentPort } from 'worker_threads';

import type { LoggerType } from '../types/Logging';
import type {
  WrappedWorkerRequest,
  WrappedWorkerResponse,
  WrappedWorkerLogEntry,
} from './main';
import db from './Server';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

const port = parentPort;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function respond(seq: number, error: Error | undefined, response?: any) {
  const wrappedResponse: WrappedWorkerResponse = {
    type: 'response',
    seq,
    error: error?.stack,
    response,
  };
  port.postMessage(wrappedResponse);
}

const log = (
  level: WrappedWorkerLogEntry['level'],
  args: Array<unknown>
): void => {
  const wrappedResponse: WrappedWorkerResponse = {
    type: 'log',
    level,
    args,
  };
  port.postMessage(wrappedResponse);
};

const logger: LoggerType = {
  fatal(...args: Array<unknown>) {
    log('fatal', args);
  },
  error(...args: Array<unknown>) {
    log('error', args);
  },
  warn(...args: Array<unknown>) {
    log('warn', args);
  },
  info(...args: Array<unknown>) {
    log('info', args);
  },
  debug(...args: Array<unknown>) {
    log('debug', args);
  },
  trace(...args: Array<unknown>) {
    log('trace', args);
  },
};

port.on('message', async ({ seq, request }: WrappedWorkerRequest) => {
  try {
    if (request.type === 'init') {
      await db.initialize({
        ...request.options,
        logger,
      });

      respond(seq, undefined, undefined);
      return;
    }

    if (request.type === 'close') {
      await db.close();

      respond(seq, undefined, undefined);
      process.exit(0);
      return;
    }

    if (request.type === 'removeDB') {
      await db.removeDB();

      respond(seq, undefined, undefined);
      return;
    }

    if (request.type === 'sqlCall') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const method = (db as any)[request.method];
      if (typeof method !== 'function') {
        throw new Error(`Invalid sql method: ${method}`);
      }

      const start = Date.now();
      const result = await method.apply(db, request.args);
      const end = Date.now();

      respond(seq, undefined, { result, duration: end - start });
    } else {
      throw new Error('Unexpected request type');
    }
  } catch (error) {
    respond(seq, error, undefined);
  }
});
