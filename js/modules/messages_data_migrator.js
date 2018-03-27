/* eslint-env browser */

// Module to upgrade the schema of messages, e.g. migrate attachments to disk.
// `processAll` is meant to be run after the initial database migrations
// (12 – 17) and purposely doesn’t rely on our Backbone IndexedDB adapter to
// prevent subsequent migrations to run (18+) but rather uses direct IndexedDB
// access. This includes avoiding usage of `storage` module which uses Backbone
// under the hood.

const isFunction = require('lodash/isFunction');
const isNumber = require('lodash/isNumber');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');
const last = require('lodash/last');

const Message = require('./types/message');
const { deferredToPromise } = require('./deferred_to_promise');


const DATABASE_NAME = 'signal';
// Last version with attachment data stored in database:
const EXPECTED_DATABASE_VERSION = 17;
const MESSAGES_STORE_NAME = 'messages';
const ITEMS_STORE_NAME = 'items';
const NUM_MESSAGES_PER_BATCH = 50;

exports.processNext = async ({
  BackboneMessage,
  BackboneMessageCollection,
  count,
  upgradeMessageSchema,
} = {}) => {
  if (!isFunction(BackboneMessage)) {
    throw new TypeError('"BackboneMessage" (Whisper.Message) constructor is required');
  }

  if (!isFunction(BackboneMessageCollection)) {
    throw new TypeError('"BackboneMessageCollection" (Whisper.MessageCollection)' +
      ' constructor is required');
  }

  if (!isNumber(count)) {
    throw new TypeError('"count" is required');
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError('"upgradeMessageSchema" is required');
  }

  const startTime = Date.now();

  const startFetchTime = Date.now();
  const messagesRequiringSchemaUpgrade =
    await _fetchMessagesRequiringSchemaUpgrade({ BackboneMessageCollection, count });
  const fetchDuration = Date.now() - startFetchTime;

  const startUpgradeTime = Date.now();
  const upgradedMessages =
    await Promise.all(messagesRequiringSchemaUpgrade.map(upgradeMessageSchema));
  const upgradeDuration = Date.now() - startUpgradeTime;

  const startSaveTime = Date.now();
  const saveMessage = _saveMessageBackbone({ BackboneMessage });
  await Promise.all(upgradedMessages.map(saveMessage));
  const saveDuration = Date.now() - startSaveTime;

  const totalDuration = Date.now() - startTime;
  const numProcessed = messagesRequiringSchemaUpgrade.length;
  const hasMore = numProcessed > 0;
  return {
    hasMore,
    numProcessed,
    fetchDuration,
    upgradeDuration,
    saveDuration,
    totalDuration,
  };
};

exports.processAll = async ({
  Backbone,
  storage,
  upgradeMessageSchema,
} = {}) => {
  if (!isObject(Backbone)) {
    throw new TypeError('"Backbone" is required');
  }

  if (!isObject(storage)) {
    throw new TypeError('"storage" is required');
  }

  if (!isFunction(upgradeMessageSchema)) {
    throw new TypeError('"upgradeMessageSchema" is required');
  }

  const connection = await openDatabase(DATABASE_NAME, EXPECTED_DATABASE_VERSION);
  const isComplete = await isMigrationComplete(connection);
  console.log('Is attachment migration complete?', isComplete);
  if (isComplete) {
    return;
  }

  const migrationStartTime = Date.now();
  let unprocessedMessages = [];
  do {
    // eslint-disable-next-line no-await-in-loop
    const lastProcessedIndex = await getLastProcessedIndex(connection);

    const fetchUnprocessedMessagesStartTime = Date.now();
    unprocessedMessages =
      // eslint-disable-next-line no-await-in-loop
      await _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex({
        connection,
        count: NUM_MESSAGES_PER_BATCH,
        lastIndex: lastProcessedIndex,
      });
    const fetchDuration = Date.now() - fetchUnprocessedMessagesStartTime;
    const numUnprocessedMessages = unprocessedMessages.length;

    const upgradeStartTime = Date.now();
    const upgradedMessages =
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(unprocessedMessages.map(upgradeMessageSchema));
    const upgradeDuration = Date.now() - upgradeStartTime;

    const saveMessagesStartTime = Date.now();
    const transaction = connection.transaction(MESSAGES_STORE_NAME, 'readwrite');
    const transactionCompletion = completeTransaction(transaction);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(upgradedMessages.map(_saveMessage({ transaction })));
    // eslint-disable-next-line no-await-in-loop
    await transactionCompletion;
    const saveDuration = Date.now() - saveMessagesStartTime;

    // TODO: Confirm transaction is complete

    const lastMessage = last(upgradedMessages);
    const newLastProcessedIndex = lastMessage ? lastMessage.id : null;
    if (newLastProcessedIndex) {
      // eslint-disable-next-line no-await-in-loop
      await setLastProcessedIndex(connection, newLastProcessedIndex);
    }

    console.log('Upgrade message schema on startup:', {
      lastProcessedIndex,
      numUnprocessedMessages,
      fetchDuration,
      saveDuration,
      upgradeDuration,
      newLastProcessedIndex,
    });
  } while (unprocessedMessages.length > 0);

  await markMigrationComplete(connection);
  connection.close();

  const totalDuration = Date.now() - migrationStartTime;
  console.log('Attachment migration complete:', { totalDuration });
};

const _saveMessageBackbone = ({ BackboneMessage } = {}) => (message) => {
  const backboneMessage = new BackboneMessage(message);
  return deferredToPromise(backboneMessage.save());
};

const _saveMessage = ({ transaction } = {}) => (message) => {
  if (!isObject(transaction)) {
    throw new TypeError('"transaction" is required');
  }

  const messagesStore = transaction.objectStore(MESSAGES_STORE_NAME);
  const request = messagesStore.put(message, message.id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () =>
      resolve();
    request.onerror = event =>
      reject(event.target.error);
  });
};

const _fetchMessagesRequiringSchemaUpgrade =
  async ({ BackboneMessageCollection, count } = {}) => {
    if (!isFunction(BackboneMessageCollection)) {
      throw new TypeError('"BackboneMessageCollection" (Whisper.MessageCollection)' +
        ' constructor is required');
    }

    if (!isNumber(count)) {
      throw new TypeError('"count" is required');
    }

    const collection = new BackboneMessageCollection();
    return new Promise(resolve => collection.fetch({
      limit: count,
      index: {
        name: 'schemaVersion',
        upper: Message.CURRENT_SCHEMA_VERSION,
        excludeUpper: true,
        order: 'desc',
      },
    }).always(() => {
      const models = collection.models || [];
      const messages = models.map(model => model.toJSON());
      resolve(messages);
    }));
  };

const _dangerouslyFetchMessagesRequiringSchemaUpgradeWithoutIndex =
  ({ connection, count, lastIndex } = {}) => {
    if (!isObject(connection)) {
      throw new TypeError('"connection" is required');
    }

    if (!isNumber(count)) {
      throw new TypeError('"count" is required');
    }

    if (lastIndex && !isString(lastIndex)) {
      throw new TypeError('"lastIndex" must be a string');
    }

    const hasLastIndex = Boolean(lastIndex);

    const transaction = connection.transaction(MESSAGES_STORE_NAME, 'readonly');
    const messagesStore = transaction.objectStore(MESSAGES_STORE_NAME);

    const excludeLowerBound = true;
    const query = hasLastIndex
      ? IDBKeyRange.lowerBound(lastIndex, excludeLowerBound)
      : undefined;
    const request = messagesStore.getAll(query, count);
    return new Promise((resolve, reject) => {
      request.onsuccess = event =>
        resolve(event.target.result);
      request.onerror = event =>
        reject(event.target.error);
    });
  };

const openDatabase = (name, version) => {
  const request = window.indexedDB.open(name, version);
  return new Promise((resolve, reject) => {
    request.onblocked = () =>
      reject(new Error('Database blocked'));

    request.onupgradeneeded = event =>
      reject(new Error('Unexpected database upgrade required:' +
        `oldVersion: ${event.oldVersion}, newVersion: ${event.newVersion}`));

    request.onerror = event =>
      reject(event.target.error);

    request.onsuccess = (event) => {
      const connection = event.target.result;
      resolve(connection);
    };
  });
};

const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

const getLastProcessedIndex = connection =>
  getItem(connection, LAST_PROCESSED_INDEX_KEY);

const setLastProcessedIndex = (connection, value) =>
  setItem(connection, LAST_PROCESSED_INDEX_KEY, value);

const isMigrationComplete = async (connection) => {
  const value = await getItem(connection, IS_MIGRATION_COMPLETE_KEY);
  return Boolean(value);
};

const markMigrationComplete = connection =>
  setItem(connection, IS_MIGRATION_COMPLETE_KEY, true);

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
  const request = itemsStore.put({id: key, value}, key);
  return new Promise((resolve, reject) => {
    request.onerror = event =>
      reject(event.target.error);

    request.onsuccess = () =>
      resolve();
  });
};

const completeTransaction = transaction =>
  new Promise((resolve, reject) => {
    transaction.addEventListener('abort', event => reject(event.target.error));
    transaction.addEventListener('error', event => reject(event.target.error));
    transaction.addEventListener('complete', () => resolve());
  });
