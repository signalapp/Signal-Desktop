const isObject = require('lodash/isObject');
const isString = require('lodash/isString');


const ITEMS_STORE_NAME = 'items';
const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

// Public API
exports.getAttachmentMigrationLastProcessedIndex = connection =>
  getItem(connection, LAST_PROCESSED_INDEX_KEY);

exports.setAttachmentMigrationLastProcessedIndex = (connection, value) =>
  setItem(connection, LAST_PROCESSED_INDEX_KEY, value);

exports.isAttachmentMigrationComplete = async connection =>
  Boolean(await getItem(connection, IS_MIGRATION_COMPLETE_KEY));

exports.markAttachmentMigrationComplete = connection =>
  setItem(connection, IS_MIGRATION_COMPLETE_KEY, true);

// Private API
const getItem = (connection, key) => {
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

const setItem = (connection, key, value) => {
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
