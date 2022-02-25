// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary';

export function waitForOnline(
  navigator: Readonly<{ onLine: boolean }>,
  onlineEventTarget: EventTarget,
  options: Readonly<{ timeout?: number }> = {}
): Promise<void> {
  const { timeout } = options;

  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    let timeoutId: undefined | ReturnType<typeof setTimeout>;

    const listener = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      onlineEventTarget.removeEventListener('online', listener);
      clearTimeoutIfNecessary(timeoutId);
    };

    onlineEventTarget.addEventListener('online', listener);

    if (timeout !== undefined) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('waitForOnline: did not come online in time'));
      }, timeout);
    }
  });
}
