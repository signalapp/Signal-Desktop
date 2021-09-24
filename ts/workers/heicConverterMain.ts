// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { Worker } from 'worker_threads';

export type WrappedWorkerRequest = {
  readonly uuid: string;
  readonly data: Uint8Array;
};

export type WrappedWorkerResponse = {
  readonly uuid: string;
  readonly error: string | undefined;
  readonly response?: File;
};

const ASAR_PATTERN = /app\.asar$/;

export function getHeicConverter(): (
  uuid: string,
  data: Uint8Array
) => Promise<WrappedWorkerResponse> {
  let appDir = join(__dirname, '..', '..');
  let isBundled = false;
  if (ASAR_PATTERN.test(appDir)) {
    appDir = appDir.replace(ASAR_PATTERN, 'app.asar.unpacked');
    isBundled = true;
  }
  const scriptDir = join(appDir, 'ts', 'workers');
  const worker = new Worker(
    join(
      scriptDir,
      isBundled ? 'heicConverter.bundle.js' : 'heicConverterWorker.js'
    )
  );

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
