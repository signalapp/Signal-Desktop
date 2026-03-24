// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { runTaskWithTimeout } from '../textsecure/TaskWithTimeout.std.js';
import { explodePromise } from '../util/explodePromise.std.js';

// Matching Whisper.events.trigger API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trigger(name: string, ...rest: Array<any>): void {
  window.Whisper.events.emit(name, ...rest);
}

export const waitForEvent = (eventName: string): Promise<void> =>
  runTaskWithTimeout(
    () => {
      const { promise, resolve } = explodePromise<void>();
      window.Whisper.events.once(eventName, () => resolve());
      return promise;
    },
    `waitForEvent:${eventName}`,
    'short-lived'
  );
