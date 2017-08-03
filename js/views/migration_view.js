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
      return storage.get('migrationState') > 0 || this.everComplete();
    },
    markComplete: function(target) {
      storage.put('migrationState', State.COMPLETE);
      storage.put('migrationEverCompleted', true);
      if (target) {
        storage.put('migrationStorageLocation', target);
      }
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
    },
    everComplete: function() {
      return Boolean(storage.get('migrationEverCompleted'));
    },
    getExportLocation: function() {
      return storage.get('migrationStorageLocation');
    }
  };

  Whisper.MigrationView = Whisper.View.extend({
    templateName: 'app-migration-screen',
    className: 'app-loading-screen',
    events: {
      'click .export': 'onClickExport',
      'click .debug-log': 'onClickDebugLog'
    },
    initialize: function() {
      if (!Whisper.Migration.inProgress()) {
        return;
      }

      // We could be wedged in an 'in progress' state, the migration was started then the
      //   app restarted in the middle.
      if (Whisper.Migration.everComplete()) {
        // If the user has ever successfully exported before, we'll show the 'finished'
        //   screen with the 'Export again' button.
        Whisper.Migration.markComplete();
      } else if (!Whisper.Migration.isComplete()) {
        // This takes the user back to the very beginning of the process.
        Whisper.Migration.cancel();
      }
    },
    render_attributes: function() {
      var message;
      var exportButton;
      var hideProgress = Whisper.Migration.isComplete();
      var debugLogButton = i18n('submitDebugLog');

      if (this.error) {
        return {
          message: i18n('exportError'),
          hideProgress: true,
          exportButton: i18n('exportAgain'),
          debugLogButton: i18n('submitDebugLog'),
        };
      }

      switch (storage.get('migrationState')) {
        case State.COMPLETE:
          var location = Whisper.Migration.getExportLocation() || i18n('selectedLocation');
          message = i18n('exportComplete', location);
          exportButton = i18n('exportAgain');
          debugLogButton = null;
          break;
        case State.EXPORTING:
          message = i18n('exporting');
          break;
        case State.DISCONNECTING:
          message = i18n('migrationDisconnecting');
          break;
        default:
          hideProgress = true;
          message = i18n('exportInstructions');
          exportButton = i18n('export');
          debugLogButton = null;
      }

      return {
        hideProgress: hideProgress,
        message: message,
        exportButton: exportButton,
        debugLogButton: debugLogButton,
      };
    },
    onClickDebugLog: function() {
      this.openDebugLog();
    },
    openDebugLog: function() {
      this.closeDebugLog();
      this.debugLogView = new Whisper.DebugLogView();
      this.debugLogView.$el.appendTo(this.el);
    },
    closeDebugLog: function() {
      if (this.debugLogView) {
        this.debugLogView.remove();
        this.debugLogView = null;
      }
    },
    onClickExport: function() {
      this.error = null;

      if (!Whisper.Migration.everComplete()) {
        return this.beginMigration();
      }

      // Different behavior for the user's second time through
      Whisper.Migration.beginExport()
        .then(this.completeMigration.bind(this))
        .catch(function(error) {
          if (error.name !== 'ChooseError') {
            this.error = error.message;
          }
          // Even if we run into an error, we call this complete because the user has
          //   completed the process once before.
          Whisper.Migration.markComplete();
          this.render();
        }.bind(this));
      this.render();
    },
    beginMigration: function() {
      // tells MessageReceiver to disconnect and drain its queue, will fire
      //   'shutdown-complete' event when that is done.
      Whisper.Migration.init();

      Whisper.events.on('shutdown-complete', function() {
        Whisper.Migration.beginExport()
          .then(this.completeMigration.bind(this))
          .catch(this.onError.bind(this));

        // Rendering because we're now in the 'exporting' state
        this.render();
      }.bind(this));

      // Rendering because we're now in the 'disconnected' state
      this.render();
    },
    completeMigration: function(target) {
      // This will prevent connection to the server on future app launches
      Whisper.Migration.markComplete(target);
      this.render();
    },
    onError: function(error) {
      if (error.name === 'ChooseError') {
        this.cancelMigration();
      } else {
        Whisper.Migration.cancel();
        this.error = error.message;
        this.render();
      }
    },
    cancelMigration: function() {
      Whisper.Migration.cancel();
      this.render();
    }
  });
}());
