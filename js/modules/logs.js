// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { ipcRenderer } = require('electron');

/* eslint-env node */

module.exports = {
  deleteAll,
};

function deleteAll() {
  return new Promise((resolve, reject) => {
    ipcRenderer.once('delete-all-logs-complete', resolve);

    setTimeout(() => {
      reject(new Error('Request to delete all logs timed out'));
    }, 5000);

    ipcRenderer.send('delete-all-logs');
  });
}
