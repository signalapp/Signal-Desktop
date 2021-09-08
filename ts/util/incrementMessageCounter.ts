// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';

let receivedAtCounter: number | undefined;

export function incrementMessageCounter(): number {
  if (!receivedAtCounter) {
    receivedAtCounter =
      Number(localStorage.getItem('lastReceivedAtCounter')) || Date.now();
  }

  receivedAtCounter += 1;
  debouncedUpdateLastReceivedAt();

  return receivedAtCounter;
}

export function flushMessageCounter(): void {
  debouncedUpdateLastReceivedAt.flush();
}

const debouncedUpdateLastReceivedAt = debounce(
  () => {
    localStorage.setItem('lastReceivedAtCounter', String(receivedAtCounter));
  },
  25,
  {
    maxWait: 25,
  }
);
