// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parentPort } from 'node:worker_threads';

import type {
  WrappedWorkerRequest,
  WrappedWorkerResponse,
} from './main.main.js';
import type { WritableDB } from './Interface.std.js';
import { initialize, DataReader, DataWriter, removeDB } from './Server.node.js';
import { SqliteErrorKind, parseSqliteError } from './errors.std.js';
import { sqlLogger as logger } from './sqlLogger.node.js';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

const port = parentPort;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function respond(seq: number, response?: any) {
  const wrappedResponse: WrappedWorkerResponse = {
    type: 'response',
    seq,
    error: undefined,
    errorKind: undefined,
    response,
  };
  port.postMessage(wrappedResponse);
}

let db: WritableDB | undefined;
let isPrimary = false;
let isRemoved = false;

const onMessage = (
  { seq, request }: WrappedWorkerRequest,
  isRetrying = false
): void => {
  try {
    if (request.type === 'init') {
      isPrimary = request.isPrimary;
      isRemoved = false;
      db = initialize({
        ...request.options,
        isPrimary,
      });

      respond(seq, undefined);
      return;
    }

    // 'close' is sent on shutdown, but we already removed the database.
    if (isRemoved && request.type === 'close') {
      respond(seq, undefined);
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

      respond(seq, undefined);
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

      respond(seq, undefined);
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

      respond(seq, { result, duration: end - start });
    } else {
      throw new Error('Unexpected request type');
    }
  } catch (error) {
    const errorKind = parseSqliteError(error);

    if (
      (errorKind === SqliteErrorKind.Corrupted ||
        errorKind === SqliteErrorKind.Logic) &&
      db != null
    ) {
      const wasRecovered = DataWriter.runCorruptionChecks(db);
      if (
        wasRecovered &&
        !isRetrying &&
        // Don't retry 'init'/'close'/'removeDB' automatically and notify user
        // about the database error (even on successful recovery).
        (request.type === 'sqlCall:read' || request.type === 'sqlCall:write')
      ) {
        logger.error(`Retrying request: ${request.type}`);
        return onMessage({ seq, request }, true);
      }
    }

    const wrappedResponse: WrappedWorkerResponse = {
      type: 'response',
      seq,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorKind,
      response: undefined,
    };
    port.postMessage(wrappedResponse);
  }
};
port.on('message', (message: WrappedWorkerRequest) => onMessage(message));
