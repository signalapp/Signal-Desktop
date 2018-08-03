const { isObject, isString } = require('lodash');

const ITEMS_STORE_NAME = 'items';
const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';
const MESSAGE_LAST_INDEX_KEY = 'sqlMigration_messageLastIndex';
const MESSAGE_COUNT_KEY = 'sqlMigration_messageCount';
const UNPROCESSED_LAST_INDEX_KEY = 'sqlMigration_unprocessedLastIndex';

// Public API
exports.READ_RECEIPT_CONFIGURATION_SYNC = 'read-receipt-configuration-sync';

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

exports.getMessageExportLastIndex = connection =>
  exports._getItem(connection, MESSAGE_LAST_INDEX_KEY);
exports.setMessageExportLastIndex = (connection, lastIndex) =>
  exports._setItem(connection, MESSAGE_LAST_INDEX_KEY, lastIndex);
exports.getMessageExportCount = connection =>
  exports._getItem(connection, MESSAGE_COUNT_KEY);
exports.setMessageExportCount = (connection, count) =>
  exports._setItem(connection, MESSAGE_COUNT_KEY, count);

exports.getUnprocessedExportLastIndex = connection =>
  exports._getItem(connection, UNPROCESSED_LAST_INDEX_KEY);
exports.setUnprocessedExportLastIndex = (connection, lastIndex) =>
  exports._setItem(connection, UNPROCESSED_LAST_INDEX_KEY, lastIndex);

// Private API
exports._getItem = (connection, key) => {
  if (!isObject(connection)) {
    throw new TypeError("'connection' is required");
  }

  if (!isString(key)) {
    throw new TypeError("'key' must be a string");
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readonly');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.get(key);
  return new Promise((resolve, reject) => {
    request.onerror = event => reject(event.target.error);

    request.onsuccess = event =>
      resolve(event.target.result ? event.target.result.value : null);
  });
};

exports._setItem = (connection, key, value) => {
  if (!isObject(connection)) {
    throw new TypeError("'connection' is required");
  }

  if (!isString(key)) {
    throw new TypeError("'key' must be a string");
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readwrite');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.put({ id: key, value }, key);
  return new Promise((resolve, reject) => {
    request.onerror = event => reject(event.target.error);

    request.onsuccess = () => resolve();
  });
};

exports._deleteItem = (connection, key) => {
  if (!isObject(connection)) {
    throw new TypeError("'connection' is required");
  }

  if (!isString(key)) {
    throw new TypeError("'key' must be a string");
  }

  const transaction = connection.transaction(ITEMS_STORE_NAME, 'readwrite');
  const itemsStore = transaction.objectStore(ITEMS_STORE_NAME);
  const request = itemsStore.delete(key);
  return new Promise((resolve, reject) => {
    request.onerror = event => reject(event.target.error);

    request.onsuccess = () => resolve();
  });
};
