// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { beforeRestart } from '../logging/set_up_renderer_logging';

export function deleteAllLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Restart logging again when the file stream close
    beforeRestart();

    const timeout = setTimeout(() => {
      reject(new Error('Request to delete all logs timed out'));
    }, 5000);

    ipcRenderer.once('delete-all-logs-complete', () => {
      clearTimeout(timeout);
      resolve();
    });

    ipcRenderer.send('delete-all-logs');
  });
}
