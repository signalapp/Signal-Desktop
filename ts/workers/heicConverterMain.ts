// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { Worker } from 'worker_threads';
import { app } from 'electron';

export type WrappedWorkerRequest = {
  readonly uuid: string;
  readonly data: Uint8Array;
};

export type WrappedWorkerResponse = {
  readonly uuid: string;
  readonly error: string | undefined;
  readonly response?: Buffer;
};

export function getHeicConverter(): (
  uuid: string,
  data: Uint8Array
) => Promise<WrappedWorkerResponse> {
  const scriptDir = join(
    app.getAppPath(),
    'ts',
    'workers',
    'heicConverterWorker.js'
  );
  const worker = new Worker(scriptDir);

  const ResponseMap = new Map<
    string,
    (response: WrappedWorkerResponse) => void
  >();

  worker.on('message', (wrappedResponse: WrappedWorkerResponse) => {
    const { uuid } = wrappedResponse;

    const resolve = ResponseMap.get(uuid);
    if (!resolve) {
      throw new Error(`Cannot find resolver for ${uuid}`);
    }

    resolve(wrappedResponse);
  });

  return async (uuid, data) => {
    const wrappedRequest: WrappedWorkerRequest = {
      uuid,
      data,
    };

    const result = new Promise<WrappedWorkerResponse>(resolve => {
      ResponseMap.set(uuid, resolve);
    });

    worker.postMessage(wrappedRequest);

    return result;
  };
}
