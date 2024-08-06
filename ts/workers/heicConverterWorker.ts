// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import heicConvert from 'heic-convert';
import { parentPort } from 'worker_threads';

import type {
  WrappedWorkerRequest,
  WrappedWorkerResponse,
} from './heicConverterMain';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

const port = parentPort;

function respond(uuid: string, error: Error | undefined, response?: Buffer) {
  const wrappedResponse: WrappedWorkerResponse = {
    uuid,
    error: error?.stack,
    response,
  };
  port.postMessage(wrappedResponse);
}

port.on('message', async ({ uuid, data }: WrappedWorkerRequest) => {
  try {
    const buf = await heicConvert({
      buffer: new Uint8Array(data),
      format: 'JPEG',
      quality: 0.75,
    });

    respond(uuid, undefined, buf);
  } catch (error) {
    respond(uuid, error, undefined);
  }
});
