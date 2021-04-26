// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parentPort } from 'worker_threads';

import { WrappedWorkerRequest, WrappedWorkerResponse } from './main';
import db from './Server';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

const port = parentPort;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function respond(seq: number, error: Error | undefined, response?: any) {
  const wrappedResponse: WrappedWorkerResponse = {
    seq,
    error: error ? error.stack : undefined,
    response,
  };
  port.postMessage(wrappedResponse);
}

port.on('message', async ({ seq, request }: WrappedWorkerRequest) => {
  try {
    if (request.type === 'init') {
      await db.initialize(request.options);

      respond(seq, undefined, undefined);
      return;
    }

    if (request.type === 'close') {
      await db.close();

      respond(seq, undefined, undefined);
      process.exit(0);
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
