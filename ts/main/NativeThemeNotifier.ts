// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-restricted-syntax */

import { ipcMain as ipc, nativeTheme, BrowserWindow } from 'electron';

import { NativeThemeState } from '../types/NativeThemeNotifier.d';

function getState(): NativeThemeState {
  return {
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
  };
}

export class NativeThemeNotifier {
  private readonly listeners = new Set<BrowserWindow>();

  public initialize(): void {
    nativeTheme.on('updated', () => {
      this.notifyListeners();
    });

    ipc.on('native-theme:init', event => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = getState();
    });
  }

  public addWindow(window: BrowserWindow): void {
    if (this.listeners.has(window)) {
      return;
    }

    this.listeners.add(window);

    window.once('closed', () => {
      this.listeners.delete(window);
    });
  }

  private notifyListeners(): void {
    for (const window of this.listeners) {
      window.webContents.send('native-theme:changed', getState());
    }
  }
}
