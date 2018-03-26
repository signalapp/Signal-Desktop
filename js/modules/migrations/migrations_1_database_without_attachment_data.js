exports.migrations = [
  {
    version: 18,
    async migrate(transaction, next) {
      console.log('Migration 18');
      next();
    },
  },
];
