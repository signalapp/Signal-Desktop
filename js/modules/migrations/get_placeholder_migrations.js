/* global window, Whisper */

const Migrations = require('./migrations');

exports.getPlaceholderMigrations = () => {
  const version = Migrations.getLatestVersion();

  return [
    {
      version,
      migrate() {
        throw new Error(
          'Unexpected invocation of placeholder migration!' +
            '\n\nMigrations must explicitly be run upon application startup instead' +
            ' of implicitly via Backbone IndexedDB adapter at any time.'
        );
      },
    },
  ];
};

exports.getCurrentVersion = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(Whisper.Database.id);

    request.onerror = reject;
    request.onupgradeneeded = reject;

    request.onsuccess = () => {
      const db = request.result;
      const { version } = db;

      return resolve(version);
    };
  });
