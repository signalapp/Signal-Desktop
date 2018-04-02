const { isObject, isString } = require('lodash');


const ITEMS_STORE_NAME = 'items';
const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

// Public API
exports.getAttachmentMigrationLastProcessedIndex = connection =>
  exports._getItem(connection, LAST_PROCESSED_INDEX_KEY);

exports.setAttachmentMigrationLastProcessedIndex = (connection, value) =>
  exports._setItem(connection, LAST_PROCESSED_INDEX_KEY, value);

exports.deleteAttachmentMigrationLastProcessedIndex = connection =>
  exports._deleteItem(connection, LAST_PROCESSED_INDEX_KEY);

exports.isAttachmentMigrationComplete = async connection =>
  Boolean(await exports._getItem(connection, IS_MIGRATION_COMPLETE_KEY));

exports.markAttachmentMigrationComplete = connection =>
  exports._setItem(connection, IS_MIGRATION_COMPLETE_KEY, true);

// Private API
exports._getItem = (connection, key) => {
  if (!isObject(connection)) {
    throw new TypeError('"connection" is required');
  }

  if (!isString(key)) {
    throw new TypeError('"key" must be a string');
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readonly');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.get(key);
  return new Promise((resolve, reject) => {
    request.onerror = event =>
      reject(event.target.error);

    request.onsuccess = event =>
      resolve(event.target.result ? event.target.result.value : null);
  });
};

exports._setItem = (connection, key, value) => {
  if (!isObject(connection)) {
    throw new TypeError('"connection" is required');
  }

  if (!isString(key)) {
    throw new TypeError('"key" must be a string');
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readwrite');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.put({ id: key, value }, key);
  return new Promise((resolve, reject) => {
    request.onerror = event =>
      reject(event.target.error);

    request.onsuccess = () =>
      resolve();
  });
};

exports._deleteItem = (connection, key) => {
  if (!isObject(connection)) {
    throw new TypeError('"connection" is required');
  }

  if (!isString(key)) {
    throw new TypeError('"key" must be a string');
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readwrite');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.delete(key);
  return new Promise((resolve, reject) => {
    request.onerror = event =>
      reject(event.target.error);

    request.onsuccess = () =>
      resolve();
  });
};
