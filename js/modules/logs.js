// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { ipcRenderer } = require('electron');

const { beforeRestart } = require('../../ts/logging/set_up_renderer_logging');

/* eslint-env node */

module.exports = {
  deleteAll,
};

function deleteAll() {
  return new Promise((resolve, reject) => {
    // Restart logging again when the file stream close
    beforeRestart();

    ipcRenderer.once('delete-all-logs-complete', resolve);

    setTimeout(() => {
      reject(new Error('Request to delete all logs timed out'));
    }, 5000);

    ipcRenderer.send('delete-all-logs');
  });
}
