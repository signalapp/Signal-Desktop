// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function waitForOnline(
  navigator: Readonly<{ onLine: boolean }>,
  onlineEventTarget: EventTarget
): Promise<void> {
  return new Promise(resolve => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    const listener = () => {
      onlineEventTarget.removeEventListener('online', listener);
      resolve();
    };

    onlineEventTarget.addEventListener('online', listener);
  });
}
