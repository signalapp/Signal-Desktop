// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'stream';
import type { Readable } from 'stream';

import * as Bytes from '../Bytes';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';
import { explodePromise } from './explodePromise';

export type OptionsType = Readonly<{
  name: string;
  timeout: number;
  abortController: { abort(): void };
}>;

export class StreamTimeoutError extends Error {}

export function getStreamWithTimeout(
  stream: Readable,
  { name, timeout, abortController }: OptionsType
): Promise<Uint8Array> {
  const { promise, resolve, reject } = explodePromise<Uint8Array>();

  const chunks = new Array<Uint8Array>();

  let timer: NodeJS.Timeout | undefined;

  const clearTimer = () => {
    clearTimeoutIfNecessary(timer);
    timer = undefined;
  };

  const reset = () => {
    clearTimer();

    timer = setTimeout(() => {
      abortController.abort();
      reject(new StreamTimeoutError(`getStreamWithTimeout(${name}) timed out`));
    }, timeout);
  };

  stream.on('data', chunk => {
    reset();

    chunks.push(chunk);
  });

  stream.on('end', () => {
    clearTimer();
    resolve(Bytes.concatenate(chunks));
  });

  stream.on('error', error => {
    clearTimer();
    reject(error);
  });

  reset();

  return promise;
}

export function getTimeoutStream({
  name,
  timeout,
  abortController,
}: OptionsType): Transform {
  const timeoutStream = new Transform();

  let timer: NodeJS.Timeout | undefined;
  const clearTimer = () => {
    clearTimeoutIfNecessary(timer);
    timer = undefined;
  };

  const reset = () => {
    clearTimer();

    timer = setTimeout(() => {
      abortController.abort();
      timeoutStream.emit(
        'error',
        new StreamTimeoutError(`getStreamWithTimeout(${name}) timed out`)
      );
      clearTimer();
    }, timeout);
  };

  timeoutStream._transform = function transform(chunk, _encoding, done) {
    try {
      reset();
    } catch (error) {
      return done(error);
    }

    this.push(chunk);

    done();
  };

  reset();

  return timeoutStream;
}
