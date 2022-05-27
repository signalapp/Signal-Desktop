// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window, clearTimeout, setTimeout */

const LEGACY_DATABASE_ID = 'signal';
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
    const req = window.indexedDB.open(LEGACY_DATABASE_ID);

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
        window.indexedDB.deleteDatabase(LEGACY_DATABASE_ID);
      }
    };
  });
}

function removeDatabase() {
  window.SignalContext.log.info(
    `Deleting IndexedDB database '${LEGACY_DATABASE_ID}'`
  );
  window.indexedDB.deleteDatabase(LEGACY_DATABASE_ID);
}
