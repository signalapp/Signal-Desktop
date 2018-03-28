const { runMigrations } = require('./run_migrations');


exports.migrations = [
  {
    version: 18,
    async migrate(transaction, next) {
      console.log('Migration 18');
      console.log('Attachments stored on disk');
      next();
    },
  },
];

exports.run = runMigrations;
