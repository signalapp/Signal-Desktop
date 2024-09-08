// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';

app.on('ready', async () => {
  ipcMain.handle('done', () => {
    app.quit();
  });

  ipcMain.handle('error', (_event, err) => {
    console.error(err);
    process.exit(1);
  });

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      devTools: true,
      nodeIntegration: false,
      sandbox: false,
      contextIsolation: true,
      preload: join(__dirname, 'generate-preload-cache.preload.js'),
    },
  });

  await window.loadURL(
    pathToFileURL(join(__dirname, 'generate-preload-cache.html')).toString()
  );

  window.webContents.openDevTools();
  window.webContents.send('compile', process.argv[2], process.argv[3]);
});
