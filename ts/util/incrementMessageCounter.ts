// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';

export function incrementMessageCounter(): number {
  if (!window.receivedAtCounter) {
    window.receivedAtCounter =
      Number(localStorage.getItem('lastReceivedAtCounter')) || Date.now();
  }

  window.receivedAtCounter += 1;
  debouncedUpdateLastReceivedAt();

  return window.receivedAtCounter;
}

const debouncedUpdateLastReceivedAt = debounce(() => {
  localStorage.setItem(
    'lastReceivedAtCounter',
    String(window.receivedAtCounter)
  );
}, 500);
