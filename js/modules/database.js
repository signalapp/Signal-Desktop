/* global indexedDB */

// Module for interacting with IndexedDB without Backbone IndexedDB adapter
// and using promises. Revisit use of `idb` dependency as it might cover
// this functionality.

const { isObject, isNumber } = require('lodash');

exports.open = (name, version, { onUpgradeNeeded } = {}) => {
  const request = indexedDB.open(name, version);
  return new Promise((resolve, reject) => {
    request.onblocked = () => reject(new Error('Database blocked'));

    request.onupgradeneeded = event => {
      const hasRequestedSpecificVersion = isNumber(version);
      if (!hasRequestedSpecificVersion) {
        return;
      }

      const { newVersion, oldVersion } = event;
      if (onUpgradeNeeded) {
        const { transaction } = event.target;
        onUpgradeNeeded({ oldVersion, transaction });
        return;
      }

      reject(
        new Error(
          'Database upgrade required:' +
            ` oldVersion: ${oldVersion}, newVersion: ${newVersion}`
        )
      );
    };

    request.onerror = event => reject(event.target.error);

    request.onsuccess = event => {
      const connection = event.target.result;
      resolve(connection);
    };
  });
};

exports.completeTransaction = transaction =>
  new Promise((resolve, reject) => {
    transaction.addEventListener('abort', event => reject(event.target.error));
    transaction.addEventListener('error', event => reject(event.target.error));
    transaction.addEventListener('complete', () => resolve());
  });

exports.getVersion = async name => {
  const connection = await exports.open(name);
  const { version } = connection;
  connection.close();
  return version;
};

exports.getCount = async ({ store } = {}) => {
  if (!isObject(store)) {
    throw new TypeError("'store' is required");
  }

  const request = store.count();
  return new Promise((resolve, reject) => {
    request.onerror = event => reject(event.target.error);
    request.onsuccess = event => resolve(event.target.result);
  });
};
