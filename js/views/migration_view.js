;(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  var State = {
    DISCONNECTING: 1,
    EXPORTING: 2,
    COMPLETE: 3
  };

  Whisper.Migration = {
    isComplete: function() {
      return storage.get('migrationState') === State.COMPLETE;
    },
    inProgress: function() {
      return storage.get('migrationState') > 0;
    },
    markComplete: function() {
      storage.put('migrationState', State.COMPLETE);
    },
    cancel: function() {
      storage.remove('migrationState');
    },
    beginExport: function() {
      storage.put('migrationState', State.EXPORTING);
      return Whisper.Backup.backupToDirectory();
    },
    init: function() {
      storage.put('migrationState', State.DISCONNECTING);
      Whisper.events.trigger('shutdown');
    }

  };

  Whisper.MigrationView = Whisper.View.extend({
    templateName: 'app-migration-screen',
    className: 'app-loading-screen',
    initialize: function() {
      Whisper.events.on('shutdown-complete', this.beginMigration.bind(this));

      Whisper.Migration.init();
    },
    render_attributes: function() {
      switch (storage.get('migrationState')) {
        case State.COMPLETE:
          return { message: i18n('exportComplete') };
        case State.EXPORTING:
          return { message: i18n('exporting') };
        case State.DISCONNECTING:
          return { message: i18n('migrationDisconnecting') };
      }
    },
    beginMigration: function() {
      Whisper.Migration.beginExport()
        .then(this.completeMigration.bind(this))
        .catch(this.cancelMigration.bind(this));
      this.render();
    },
    completeMigration: function() {
      // disable this client
      Whisper.Migration.markComplete();
      this.render();
    },
    cancelMigration: function(error) {
      Whisper.Migration.cancel();
      this.remove();
    }
  });
}());
