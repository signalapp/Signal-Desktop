// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

export function startUpdate(): Promise<void> {
  return ipcRenderer.invoke('start-update');
}

export function forceUpdate(): Promise<void> {
  return ipcRenderer.invoke('updater/force-update');
}
