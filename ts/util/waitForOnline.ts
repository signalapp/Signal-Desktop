// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';

export type WaitForOnlineOptionsType = Readonly<{
  server?: Readonly<{ isOnline: () => boolean | undefined }>;
  events?: {
    on: (event: 'online', fn: () => void) => void;
    off: (event: 'online', fn: () => void) => void;
  };
  timeout?: number;
}>;

export function waitForOnline({
  server: maybeServer,
  events = window.Whisper.events,
  timeout,
}: WaitForOnlineOptionsType = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    let server = maybeServer;
    if (server === undefined) {
      ({ server } = window.textsecure);
      if (!server) {
        reject(new Error('waitForOnline: no textsecure server'));
        return;
      }
    }

    if (server.isOnline()) {
      resolve();
      return;
    }

    let timeoutId: undefined | ReturnType<typeof setTimeout>;

    const listener = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      events.off('online', listener);
      clearTimeoutIfNecessary(timeoutId);
    };

    events.on('online', listener);

    if (timeout !== undefined) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('waitForOnline: did not come online in time'));
      }, timeout);
    }
  });
}
