/* global window, Whisper, textsecure */

const { isFunction } = require('lodash');

const MessageDataMigrator = require('./messages_data_migrator');
const {
  run,
  getLatestVersion,
  getDatabase,
} = require('./migrations/migrations');

const MESSAGE_MINIMUM_VERSION = 7;

module.exports = {
  doesDatabaseExist,
  mandatoryMessageUpgrade,
  MESSAGE_MINIMUM_VERSION,
  migrateAllToSQLCipher,
  removeDatabase,
  runMigrations,
};

async function runMigrations() {
  window.log.info('Run migrations on database with attachment data');
  await run({
    Backbone: window.Backbone,
    logger: window.log,
  });

  Whisper.Database.migrations[0].version = getLatestVersion();
}

async function mandatoryMessageUpgrade({ upgradeMessageSchema } = {}) {
  if (!isFunction(upgradeMessageSchema)) {
    throw new Error(
      'mandatoryMessageUpgrade: upgradeMessageSchema must be a function!'
    );
  }

  const NUM_MESSAGES_PER_BATCH = 10;
  window.log.info(
    'upgradeMessages: Mandatory message schema upgrade started.',
    `Target version: ${MESSAGE_MINIMUM_VERSION}`
  );

  let isMigrationWithoutIndexComplete = false;
  while (!isMigrationWithoutIndexComplete) {
    const database = getDatabase();
    // eslint-disable-next-line no-await-in-loop
    const batchWithoutIndex = await MessageDataMigrator.processNextBatchWithoutIndex(
      {
        databaseName: database.name,
        minDatabaseVersion: database.version,
        numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
        upgradeMessageSchema,
        maxVersion: MESSAGE_MINIMUM_VERSION,
        BackboneMessage: Whisper.Message,
        saveMessage: window.Signal.Data.saveLegacyMessage,
      }
    );
    window.log.info(
      'upgradeMessages: upgrade without index',
      batchWithoutIndex
    );
    isMigrationWithoutIndexComplete = batchWithoutIndex.done;
  }
  window.log.info('upgradeMessages: upgrade without index complete!');

  let isMigrationWithIndexComplete = false;
  while (!isMigrationWithIndexComplete) {
    // eslint-disable-next-line no-await-in-loop
    const batchWithIndex = await MessageDataMigrator.processNext({
      BackboneMessage: Whisper.Message,
      BackboneMessageCollection: Whisper.MessageCollection,
      numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
      upgradeMessageSchema,
      getMessagesNeedingUpgrade:
        window.Signal.Data.getLegacyMessagesNeedingUpgrade,
      saveMessage: window.Signal.Data.saveLegacyMessage,
      maxVersion: MESSAGE_MINIMUM_VERSION,
    });
    window.log.info('upgradeMessages: upgrade with index', batchWithIndex);
    isMigrationWithIndexComplete = batchWithIndex.done;
  }
  window.log.info('upgradeMessages: upgrade with index complete!');

  window.log.info('upgradeMessages: Message schema upgrade complete');
}

async function migrateAllToSQLCipher({ writeNewAttachmentData, Views } = {}) {
  if (!isFunction(writeNewAttachmentData)) {
    throw new Error(
      'migrateAllToSQLCipher: writeNewAttachmentData must be a function'
    );
  }
  if (!Views) {
    throw new Error('migrateAllToSQLCipher: Views must be provided!');
  }

  let totalMessages;
  const db = await Whisper.Database.open();

  function showMigrationStatus(current) {
    const status = `${current}/${totalMessages}`;
    Views.Initialization.setMessage(
      window.i18n('migratingToSQLCipher', [status])
    );
  }

  try {
    totalMessages = await MessageDataMigrator.getNumMessages({
      connection: db,
    });
  } catch (error) {
    window.log.error(
      'background.getNumMessages error:',
      error && error.stack ? error.stack : error
    );
    totalMessages = 0;
  }

  if (totalMessages) {
    window.log.info(`About to migrate ${totalMessages} messages`);
    showMigrationStatus(0);
  } else {
    window.log.info('About to migrate non-messages');
  }

  await window.Signal.migrateToSQL({
    db,
    clearStores: Whisper.Database.clearStores,
    handleDOMException: Whisper.Database.handleDOMException,
    arrayBufferToString: textsecure.MessageReceiver.arrayBufferToStringBase64,
    countCallback: count => {
      window.log.info(`Migration: ${count} messages complete`);
      showMigrationStatus(count);
    },
    writeNewAttachmentData,
  });

  db.close();
}

async function doesDatabaseExist() {
  return new Promise((resolve, reject) => {
    const { id } = Whisper.Database;
    const req = window.indexedDB.open(id);

    let existed = true;

    req.onerror = reject;
    req.onsuccess = () => {
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
  window.log.info(`Deleting IndexedDB database '${Whisper.Database.id}'`);
  window.indexedDB.deleteDatabase(Whisper.Database.id);
}
