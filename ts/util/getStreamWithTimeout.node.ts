// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary.std.ts';

export type OptionsType = Readonly<{
  name: string;
  timeout: number;
  abortController: { abort(): void };
}>;

class StreamTimeoutError extends Error {}

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
