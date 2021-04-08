// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import fs from 'fs-extra';
import pify from 'pify';
import sql from './Server';

const getRealPath = pify(fs.realpath);

// Called from renderer.
export async function initialize(isTesting = false): Promise<void> {
  if (!isTesting) {
    ipc.send('database-ready');

    await new Promise<void>(resolve => {
      ipc.once('database-ready', () => {
        resolve();
      });
    });
  }

  const configDir = await getRealPath(ipc.sendSync('get-user-data-path'));
  const key = ipc.sendSync('user-config-key');

  await sql.initializeRenderer({ configDir, key });
}

export function goBackToMainProcess(): void {
  window.Signal.Data.goBackToMainProcess();
}
