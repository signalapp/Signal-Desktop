/* global window, Whisper */

const Migrations0DatabaseWithAttachmentData = require('./migrations_0_database_with_attachment_data');

exports.getPlaceholderMigrations = () => {
  const last0MigrationVersion = Migrations0DatabaseWithAttachmentData.getLatestVersion();

  return [
    {
      version: last0MigrationVersion,
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
