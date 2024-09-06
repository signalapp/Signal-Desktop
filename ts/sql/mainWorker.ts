// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parentPort } from 'worker_threads';

import type { LoggerType } from '../types/Logging';
import type {
  WrappedWorkerRequest,
  WrappedWorkerResponse,
  WrappedWorkerLogEntry,
} from './main';
import type { WritableDB } from './Interface';
import { initialize, DataReader, DataWriter, removeDB } from './Server';
import { SqliteErrorKind, parseSqliteError } from './errors';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

const port = parentPort;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function respond(seq: number, error: Error | undefined, response?: any) {
  let errorKind: SqliteErrorKind | undefined;
  if (error !== undefined) {
    errorKind = parseSqliteError(error);

    if (errorKind === SqliteErrorKind.Corrupted && db != null) {
      DataWriter.runCorruptionChecks(db);
    }
  }

  const wrappedResponse: WrappedWorkerResponse = {
    type: 'response',
    seq,
    error:
      error == null
        ? undefined
        : {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
    errorKind,
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

let db: WritableDB | undefined;
let isPrimary = false;
let isRemoved = false;

port.on('message', ({ seq, request }: WrappedWorkerRequest) => {
  try {
    if (request.type === 'init') {
      isPrimary = request.isPrimary;
      isRemoved = false;
      db = initialize({
        ...request.options,
        isPrimary,
        logger,
      });

      respond(seq, undefined, undefined);
      return;
    }

    // 'close' is sent on shutdown, but we already removed the database.
    if (isRemoved && request.type === 'close') {
      respond(seq, undefined, undefined);
      process.exit(0);
      return;
    }

    // Removing database does not require active connection.
    if (request.type === 'removeDB') {
      try {
        if (db) {
          if (isPrimary) {
            DataWriter.close(db);
          } else {
            DataReader.close(db);
          }
          db = undefined;
        }
      } catch (error) {
        logger.error('Failed to close database before removal');
      }

      if (isPrimary) {
        removeDB();
      }

      isRemoved = true;

      respond(seq, undefined, undefined);
      return;
    }

    if (!db) {
      throw new Error('Not initialized');
    }

    if (request.type === 'close') {
      if (isPrimary) {
        DataWriter.close(db);
      } else {
        DataReader.close(db);
      }
      db = undefined;

      respond(seq, undefined, undefined);
      process.exit(0);
      return;
    }

    if (request.type === 'sqlCall:read' || request.type === 'sqlCall:write') {
      const DataInterface =
        request.type === 'sqlCall:read' ? DataReader : DataWriter;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const method = (DataInterface as any)[request.method];
      if (typeof method !== 'function') {
        throw new Error(`Invalid sql method: ${request.method} ${method}`);
      }

      const start = performance.now();
      const result = method(db, ...request.args);
      const end = performance.now();

      respond(seq, undefined, { result, duration: end - start });
    } else {
      throw new Error('Unexpected request type');
    }
  } catch (error) {
    respond(seq, error, undefined);
  }
});
