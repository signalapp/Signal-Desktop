const { runMigrations } = require('./run_migrations');


exports.migrations = [
  {
    version: 18,
    async migrate(transaction, next) {
      console.log('Migration 18');
      next();
    },
  },
];

exports.run = ({ Backbone, closeDatabase, Database } = {}) =>
  runMigrations({ Backbone, closeDatabase, database: Database });
