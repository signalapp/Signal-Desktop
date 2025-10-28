// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

export function bounceAppIconStart(isCritical = false): void {
  ipcRenderer.send('bounce-app-icon-start', isCritical);
}

export function bounceAppIconStop(): void {
  ipcRenderer.send('bounce-app-icon-stop');
}
