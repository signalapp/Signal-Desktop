// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window, Whisper, clearTimeout, setTimeout */

const MESSAGE_MINIMUM_VERSION = 7;

module.exports = {
  doesDatabaseExist,
  MESSAGE_MINIMUM_VERSION,
  removeDatabase,
};

async function doesDatabaseExist() {
  window.SignalContext.log.info(
    'Checking for the existence of IndexedDB data...'
  );
  return new Promise((resolve, reject) => {
    const { id } = Whisper.Database;
    const req = window.indexedDB.open(id);

    let existed = true;

    let timer = setTimeout(() => {
      window.SignalContext.log.warn(
        'doesDatabaseExist: Timed out attempting to check IndexedDB status'
      );
      return resolve(false);
    }, 1000);

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    req.onerror = error => {
      clearTimer();
      reject(error);
    };
    req.onsuccess = () => {
      clearTimer();
      req.result.close();
      resolve(existed);
    };
    req.onupgradeneeded = () => {
      if (req.result.version === 1) {
        existed = false;
        window.indexedDB.deleteDatabase(id);
      }
    };
  });
}

function removeDatabase() {
  window.SignalContext.log.info(
    `Deleting IndexedDB database '${Whisper.Database.id}'`
  );
  window.indexedDB.deleteDatabase(Whisper.Database.id);
}
