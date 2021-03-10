// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import fs from 'fs-extra';
import pify from 'pify';
import sql from './Server';

const getRealPath = pify(fs.realpath);

export async function initialize(): Promise<void> {
  const configDir = await getRealPath(ipc.sendSync('get-user-data-path'));
  const key = ipc.sendSync('user-config-key');

  await sql.initializeRenderer({ configDir, key });
}

export function goBackToMainProcess(): void {
  window.Signal.Data.goBackToMainProcess();
}
