/* global window, IDBKeyRange */

const { includes, isFunction, isString, last, map } = require('lodash');
const {
  bulkAddGroups,
  bulkAddSessions,
  bulkAddIdentityKeys,
  bulkAddPreKeys,
  bulkAddSignedPreKeys,
  bulkAddItems,

  removeGroupById,
  removeSessionById,
  removeIdentityKeyById,
  removePreKeyById,
  removeSignedPreKeyById,
  removeItemById,

  saveMessages,
  _removeMessages,

  saveUnprocesseds,
  removeUnprocessed,

  saveConversations,
  _removeConversations,
} = require('./data');
const {
  getMessageExportLastIndex,
  setMessageExportLastIndex,
  getMessageExportCount,
  setMessageExportCount,
  getUnprocessedExportLastIndex,
  setUnprocessedExportLastIndex,
} = require('./settings');
const { migrateConversation } = require('./types/conversation');

module.exports = {
  migrateToSQL,
};

async function migrateToSQL({
  db,
  clearStores,
  handleDOMException,
  countCallback,
  arrayBufferToString,
  writeNewAttachmentData,
}) {
  if (!db) {
    throw new Error('Need db for IndexedDB connection!');
  }
  if (!isFunction(clearStores)) {
    throw new Error('Need clearStores function!');
  }
  if (!isFunction(arrayBufferToString)) {
    throw new Error('Need arrayBufferToString function!');
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
  try {
    await clearStores(['messages']);
  } catch (error) {
    window.log.warn('Failed to clear messages store');
  }

  lastIndex = await getUnprocessedExportLastIndex(db);
  complete = false;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      save: async array => {
        await Promise.all(
          map(array, async item => {
            // In the new database, we can't store ArrayBuffers, so we turn these two
            //   fields into strings like MessageReceiver now does before save.

            // Need to set it to version two, since we're using Base64 strings now
            // eslint-disable-next-line no-param-reassign
            item.version = 2;

            if (item.envelope) {
              // eslint-disable-next-line no-param-reassign
              item.envelope = await arrayBufferToString(item.envelope);
            }
            if (item.decrypted) {
              // eslint-disable-next-line no-param-reassign
              item.decrypted = await arrayBufferToString(item.decrypted);
            }
          })
        );
        await saveUnprocesseds(array);
      },
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
  try {
    await clearStores(['unprocessed']);
  } catch (error) {
    window.log.warn('Failed to clear unprocessed store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: async array => {
        const conversations = await Promise.all(
          map(array, async conversation =>
            migrateConversation(conversation, { writeNewAttachmentData })
          )
        );

        saveConversations(conversations);
      },
      remove: _removeConversations,
      storeName: 'conversations',
      handleDOMException,
      lastIndex,
      // Because we're doing real-time moves to the filesystem, minimize parallelism
      batchSize: 5,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of conversations complete');
  try {
    await clearStores(['conversations']);
  } catch (error) {
    window.log.warn('Failed to clear conversations store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddGroups,
      remove: removeGroupById,
      storeName: 'groups',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of groups complete');
  try {
    await clearStores(['groups']);
  } catch (error) {
    window.log.warn('Failed to clear groups store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddSessions,
      remove: removeSessionById,
      storeName: 'sessions',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of sessions complete');
  try {
    await clearStores(['sessions']);
  } catch (error) {
    window.log.warn('Failed to clear sessions store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddIdentityKeys,
      remove: removeIdentityKeyById,
      storeName: 'identityKeys',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of identityKeys complete');
  try {
    await clearStores(['identityKeys']);
  } catch (error) {
    window.log.warn('Failed to clear identityKeys store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddPreKeys,
      remove: removePreKeyById,
      storeName: 'preKeys',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of preKeys complete');
  try {
    await clearStores(['preKeys']);
  } catch (error) {
    window.log.warn('Failed to clear preKeys store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddSignedPreKeys,
      remove: removeSignedPreKeyById,
      storeName: 'signedPreKeys',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of signedPreKeys complete');
  try {
    await clearStores(['signedPreKeys']);
  } catch (error) {
    window.log.warn('Failed to clear signedPreKeys store');
  }

  complete = false;
  lastIndex = null;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const status = await migrateStoreToSQLite({
      db,
      // eslint-disable-next-line no-loop-func
      save: bulkAddItems,
      remove: removeItemById,
      storeName: 'items',
      handleDOMException,
      lastIndex,
      batchSize: 10,
    });

    ({ complete, lastIndex } = status);
  }
  window.log.info('migrateToSQL: migrate of items complete');
  // Note: we don't clear the items store because it contains important metadata which,
  //   if this process fails, will be crucial to going through this process again.

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
