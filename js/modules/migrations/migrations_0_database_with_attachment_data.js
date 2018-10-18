/* global window */

const { isString, last } = require('lodash');

const { runMigrations } = require('./run_migrations');
const Migration18 = require('./18');

// IMPORTANT: The migrations below are run on a database that may be very large
// due to attachments being directly stored inside the database. Please avoid
// any expensive operations, e.g. modifying all messages / attachments, etc., as
// it may cause out-of-memory errors for users with long histories:
// https://github.com/signalapp/Signal-Desktop/issues/2163
const migrations = [
  {
    version: '12.0',
    migrate(transaction, next) {
      window.log.info('Migration 12');
      window.log.info('creating object stores');
      const messages = transaction.db.createObjectStore('messages');
      messages.createIndex('conversation', ['conversationId', 'received_at'], {
        unique: false,
      });
      messages.createIndex('receipt', 'sent_at', { unique: false });
      messages.createIndex('unread', ['conversationId', 'unread'], {
        unique: false,
      });
      messages.createIndex('expires_at', 'expires_at', { unique: false });

      const conversations = transaction.db.createObjectStore('conversations');
      conversations.createIndex('inbox', 'active_at', { unique: false });
      conversations.createIndex('group', 'members', {
        unique: false,
        multiEntry: true,
      });
      conversations.createIndex('type', 'type', {
        unique: false,
      });
      conversations.createIndex('search', 'tokens', {
        unique: false,
        multiEntry: true,
      });

      transaction.db.createObjectStore('groups');

      transaction.db.createObjectStore('sessions');
      transaction.db.createObjectStore('identityKeys');
      const preKeys = transaction.db.createObjectStore('preKeys', { keyPath: 'id'});
      preKeys.createIndex('recipient', 'recipient', { unique: true });

      transaction.db.createObjectStore('signedPreKeys');
      transaction.db.createObjectStore('items');
      
      const contactPreKeys = transaction.db.createObjectStore('contactPreKeys', { keyPath: 'id', autoIncrement : true });
      contactPreKeys.createIndex('identityKeyString', 'identityKeyString', { unique: false });
      
      const contactSignedPreKeys = transaction.db.createObjectStore('contactSignedPreKeys', { keyPath: 'id', autoIncrement : true });
      contactSignedPreKeys.createIndex('identityKeyString', 'identityKeyString', { unique: false });

      window.log.info('creating debug log');
      transaction.db.createObjectStore('debug');

      next();
    },
  },
  {
    version: '13.0',
    migrate(transaction, next) {
      window.log.info('Migration 13');
      window.log.info('Adding fields to identity keys');
      const identityKeys = transaction.objectStore('identityKeys');
      const request = identityKeys.openCursor();
      const promises = [];
      request.onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
          const attributes = cursor.value;
          attributes.timestamp = 0;
          attributes.firstUse = false;
          attributes.nonblockingApproval = false;
          attributes.verified = 0;
          promises.push(
            new Promise((resolve, reject) => {
              const putRequest = identityKeys.put(attributes, attributes.id);
              putRequest.onsuccess = resolve;
              putRequest.onerror = error => {
                window.log.error(error && error.stack ? error.stack : error);
                reject(error);
              };
            })
          );
          cursor.continue();
        } else {
          // no more results
          // eslint-disable-next-line more/no-then
          Promise.all(promises).then(() => {
            next();
          });
        }
      };
      request.onerror = event => {
        window.log.error(event);
      };
    },
  },
  {
    version: '14.0',
    migrate(transaction, next) {
      window.log.info('Migration 14');
      window.log.info('Adding unprocessed message store');
      const unprocessed = transaction.db.createObjectStore('unprocessed');
      unprocessed.createIndex('received', 'timestamp', { unique: false });
      next();
    },
  },
  {
    version: '15.0',
    migrate(transaction, next) {
      window.log.info('Migration 15');
      window.log.info('Adding messages index for de-duplication');
      const messages = transaction.objectStore('messages');
      messages.createIndex('unique', ['source', 'sourceDevice', 'sent_at'], {
        unique: true,
      });
      next();
    },
  },
  {
    version: '16.0',
    migrate(transaction, next) {
      window.log.info('Migration 16');
      window.log.info('Dropping log table, since we now log to disk');
      transaction.db.deleteObjectStore('debug');
      next();
    },
  },
  {
    version: 17,
    async migrate(transaction, next) {
      window.log.info('Migration 17');

      const start = Date.now();

      const messagesStore = transaction.objectStore('messages');
      window.log.info(
        'Create index from attachment schema version to attachment'
      );
      messagesStore.createIndex('schemaVersion', 'schemaVersion', {
        unique: false,
      });

      const duration = Date.now() - start;

      window.log.info(
        'Complete migration to database version 17',
        `Duration: ${duration}ms`
      );
      next();
    },
  },
  {
    version: 18,
    migrate(transaction, next) {
      window.log.info('Migration 18');

      const start = Date.now();
      Migration18.run({ transaction, logger: window.log });
      const duration = Date.now() - start;

      window.log.info(
        'Complete migration to database version 18',
        `Duration: ${duration}ms`
      );
      next();
    },
  },
];

const database = {
  id: 'loki-messenger',
  nolog: true,
  migrations,
};

exports.run = ({ Backbone, databaseName, logger } = {}) =>
  runMigrations({
    Backbone,
    logger,
    database: Object.assign(
      {},
      database,
      isString(databaseName) ? { id: databaseName } : {}
    ),
  });

exports.getDatabase = () => ({
  name: database.id,
  version: exports.getLatestVersion(),
});

exports.getLatestVersion = () => {
  const lastMigration = last(migrations);
  if (!lastMigration) {
    return null;
  }

  return lastMigration.version;
};
