// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { powerMonitor } from 'electron';

export type InitializeOptions = {
  send(event: string): void;
};

export namespace PowerChannel {
  let isInitialized = false;

  export function initialize({ send }: InitializeOptions): void {
    if (isInitialized) {
      throw new Error('PowerChannel already initialized');
    }
    isInitialized = true;

    powerMonitor.on('suspend', () => {
      send('power-channel:suspend');
    });
    powerMonitor.on('resume', () => {
      send('power-channel:resume');
    });
    powerMonitor.on('lock-screen', () => {
      send('power-channel:lock-screen');
    });
  }
}
