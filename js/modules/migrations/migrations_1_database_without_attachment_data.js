/* global window */

const { last, includes } = require('lodash');

const { open } = require('../database');
const settings = require('../settings');
const { runMigrations } = require('./run_migrations');

// These are cleanup migrations, to be run after migration to SQLCipher
exports.migrations = [
  {
    version: 20,
    migrate(transaction, next) {
      window.log.info('Migration 20');

      const { db } = transaction;

      // This should be run after things are migrated to SQLCipher

      // We check for existence first, because this removal was present in v1.17.0.beta.1,
      //  but reverted in v1.17.0-beta.3

      if (includes(db.objectStoreNames, 'messages')) {
        window.log.info('Removing messages store');
        db.deleteObjectStore('messages');
      }
      if (includes(db.objectStoreNames, 'unprocessed')) {
        window.log.info('Removing unprocessed store');
        db.deleteObjectStore('unprocessed');
      }
      if (includes(db.objectStoreNames, 'conversations')) {
        window.log.info('Removing conversations store');
        db.deleteObjectStore('conversations');
      }

      next();
    },
  },
];

exports.run = async ({ Backbone, logger } = {}) => {
  const database = {
    id: 'signal',
    nolog: true,
    migrations: exports.migrations,
  };

  const { canRun } = await exports.getStatus({ database });
  if (!canRun) {
    throw new Error(
      'Cannot run migrations on database without attachment data'
    );
  }

  await runMigrations({
    Backbone,
    logger,
    database,
  });
};

exports.getStatus = async ({ database } = {}) => {
  const connection = await open(database.id, database.version);
  const isAttachmentMigrationComplete = await settings.isAttachmentMigrationComplete(
    connection
  );
  const hasMigrations = exports.migrations.length > 0;

  const canRun = isAttachmentMigrationComplete && hasMigrations;
  return {
    isAttachmentMigrationComplete,
    hasMigrations,
    canRun,
  };
};

exports.getLatestVersion = () => {
  const lastMigration = last(exports.migrations);
  if (!lastMigration) {
    return null;
  }

  return lastMigration.version;
};
