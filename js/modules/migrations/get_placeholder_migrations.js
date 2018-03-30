const Migrations0DatabaseWithAttachmentData =
  require('./migrations_0_database_with_attachment_data');
const Migrations1DatabaseWithoutAttachmentData =
  require('./migrations_1_database_without_attachment_data');


exports.getPlaceholderMigrations = () => {
  const last0MigrationVersion =
    Migrations0DatabaseWithAttachmentData.getLatestVersion();
  const last1MigrationVersion =
    Migrations1DatabaseWithoutAttachmentData.getLatestVersion();

  const lastMigrationVersion = last1MigrationVersion || last0MigrationVersion;

  return [{
    version: lastMigrationVersion,
    migrate() {
      throw new Error('Unexpected invocation of placeholder migration!' +
        '\n\nMigrations must explicitly be run upon application startup instead' +
        ' of implicitly via Backbone IndexedDB adapter at any time.');
    },
  }];
};
