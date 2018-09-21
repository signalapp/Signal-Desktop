/* global window */

const { last } = require('lodash');

const db = require('../database');
const settings = require('../settings');
const { runMigrations } = require('./run_migrations');

// These are cleanup migrations, to be run after migration to SQLCipher
exports.migrations = [
  {
    version: 19,
    migrate(transaction, next) {
      window.log.info('Migration 19');
      window.log.info(
        'Removing messages, unprocessed, and conversations object stores'
      );

      // This should be run after things are migrated to SQLCipher
      transaction.db.deleteObjectStore('messages');
      transaction.db.deleteObjectStore('unprocessed');
      transaction.db.deleteObjectStore('conversations');

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
  const connection = await db.open(database.id, database.version);
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
