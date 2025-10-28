// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { BrowserWindow } from 'electron';
import { app, ipcMain } from 'electron';

let bounceId = -1;

export function init(win: BrowserWindow): void {
  ipcMain.on('bounce-app-icon-start', (_, isCritical = false) => {
    if (app.dock) {
      const type = isCritical ? 'critical' : 'informational';
      bounceId = app.dock.bounce(type);
    } else if (win && win.flashFrame) {
      win.once('focus', () => {
        win.flashFrame(false);
      });
      win.flashFrame(true);
    }
  });

  ipcMain.on('bounce-app-icon-stop', () => {
    if (app.dock) {
      if (bounceId < 0) {
        return;
      }

      app.dock.cancelBounce(bounceId);
      bounceId = -1;
    } else if (win && win.flashFrame) {
      win.flashFrame(false);
    }
  });
}
