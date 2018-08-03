/* global window, IDBKeyRange */

const { includes, isFunction, isString, last } = require('lodash');
const {
  saveMessages,
  _removeMessages,
  saveUnprocesseds,
  removeUnprocessed,
} = require('./data');
const {
  getMessageExportLastIndex,
  setMessageExportLastIndex,
  getMessageExportCount,
  setMessageExportCount,
  getUnprocessedExportLastIndex,
  setUnprocessedExportLastIndex,
} = require('./settings');

module.exports = {
  migrateToSQL,
};

async function migrateToSQL({
  db,
  clearStores,
  handleDOMException,
  countCallback,
}) {
  if (!db) {
    throw new Error('Need db for IndexedDB connection!');
  }
  if (!isFunction(clearStores)) {
    throw new Error('Need clearStores function!');
  }
  if (!isFunction(handleDOMException)) {
    throw new Error('Need handleDOMException function!');
  }

  window.log.info('migrateToSQL: start');

  let [lastIndex, doneSoFar] = await Promise.all([
    getMessageExportLastIndex(db),
    getMessageExportCount(db),
  ]);
  let complete = false;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      save: saveMessages,
      remove: _removeMessages,
      storeName: 'messages',
      handleDOMException,
      lastIndex,
    });

    ({ complete, lastIndex } = status);

    // eslint-disable-next-line no-await-in-loop
    await Promise.all([
      setMessageExportCount(db, doneSoFar),
      setMessageExportLastIndex(db, lastIndex),
    ]);

    const { count } = status;
    doneSoFar += count;
    if (countCallback) {
      countCallback(doneSoFar);
    }
  }
  window.log.info('migrateToSQL: migrate of messages complete');

  lastIndex = await getUnprocessedExportLastIndex(db);
  complete = false;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      save: saveUnprocesseds,
      remove: removeUnprocessed,
      storeName: 'unprocessed',
      handleDOMException,
      lastIndex,
    });

    ({ complete, lastIndex } = status);

    // eslint-disable-next-line no-await-in-loop
    await setUnprocessedExportLastIndex(db, lastIndex);
  }
  window.log.info('migrateToSQL: migrate of unprocessed complete');

  await clearStores(['messages', 'unprocessed']);

  window.log.info('migrateToSQL: complete');
}

async function migrateStoreToSQLite({
  db,
  save,
  remove,
  storeName,
  handleDOMException,
  lastIndex = null,
  batchSize = 50,
}) {
  if (!db) {
    throw new Error('Need db for IndexedDB connection!');
  }
  if (!isFunction(save)) {
    throw new Error('Need save function!');
  }
  if (!isFunction(remove)) {
    throw new Error('Need remove function!');
  }
  if (!isString(storeName)) {
    throw new Error('Need storeName!');
  }
  if (!isFunction(handleDOMException)) {
    throw new Error('Need handleDOMException for error handling!');
  }

  if (!includes(db.objectStoreNames, storeName)) {
    return {
      complete: true,
      count: 0,
    };
  }

  const queryPromise = new Promise((resolve, reject) => {
    const items = [];
    const transaction = db.transaction(storeName, 'readonly');
    transaction.onerror = () => {
      handleDOMException(
        'migrateToSQLite transaction error',
        transaction.error,
        reject
      );
    };
    transaction.oncomplete = () => {};

    const store = transaction.objectStore(storeName);
    const excludeLowerBound = true;
    const range = lastIndex
      ? IDBKeyRange.lowerBound(lastIndex, excludeLowerBound)
      : undefined;
    const request = store.openCursor(range);
    request.onerror = () => {
      handleDOMException(
        'migrateToSQLite: request error',
        request.error,
        reject
      );
    };
    request.onsuccess = event => {
      const cursor = event.target.result;

      if (!cursor || !cursor.value) {
        return resolve({
          complete: true,
          items,
        });
      }

      const item = cursor.value;
      items.push(item);

      if (items.length >= batchSize) {
        return resolve({
          complete: false,
          items,
        });
      }

      return cursor.continue();
    };
  });

  const { items, complete } = await queryPromise;

  if (items.length) {
    // Because of the force save and some failed imports, we're going to delete before
    //   we attempt to insert.
    const ids = items.map(item => item.id);
    await remove(ids);

    // We need to pass forceSave parameter, because these items already have an
    //   id key. Normally, this call would be interpreted as an update request.
    await save(items, { forceSave: true });
  }

  const lastItem = last(items);
  const id = lastItem ? lastItem.id : null;

  return {
    complete,
    count: items.length,
    lastIndex: id,
  };
}
