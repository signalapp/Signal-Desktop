// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import { MINUTE } from '../util/durations';
import { explodePromise } from '../util/explodePromise';

// Matching Whisper.events.trigger API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trigger(name: string, ...rest: Array<any>): void {
  window.Whisper.events.trigger(name, ...rest);
}

export const waitForEvent = (
  eventName: string,
  timeout: number = 2 * MINUTE
): Promise<void> =>
  createTaskWithTimeout(
    (event: string): Promise<void> => {
      const { promise, resolve } = explodePromise<void>();
      window.Whisper.events.once(event, () => resolve());
      return promise;
    },
    `waitForEvent:${eventName}`,
    { timeout }
  )(eventName);
