/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  var State = {
    IMPORTING: 1,
    COMPLETE: 2
  };

  var IMPORT_STARTED = 'importStarted';
  var IMPORT_COMPLETE = 'importComplete';
  var IMPORT_LOCATION = 'importLocation';

  Whisper.Import = {
    isStarted: function() {
      return Boolean(storage.get(IMPORT_STARTED));
    },
    isComplete: function() {
      return Boolean(storage.get(IMPORT_COMPLETE));
    },
    isIncomplete: function() {
      return this.isStarted() && !this.isComplete();
    },
    start: function() {
      return storage.put(IMPORT_STARTED, true);
    },
    complete: function() {
      return storage.put(IMPORT_COMPLETE, true);
    },
    saveLocation: function(location) {
      return storage.put(IMPORT_LOCATION, location);
    },
    reset: function() {
      return Whisper.Backup.clearDatabase();
    }
  };

  Whisper.ImportView = Whisper.View.extend({
    templateName: 'app-migration-screen',
    className: 'app-loading-screen',
    events: {
      'click .import': 'onImport',
      'click .restart': 'onRestart',
      'click .cancel': 'onCancel',
    },
    initialize: function() {
      if (Whisper.Import.isIncomplete()) {
        this.error = true;
      }

      this.render();
      this.pending = Promise.resolve();
    },
    render_attributes: function() {
      var message;
      var importButton;
      var hideProgress = true;
      var restartButton;
      var cancelButton;

      if (this.error) {
        return {
          message: i18n('importError'),
          hideProgress: true,
          importButton: i18n('tryAgain'),
        };
      }

      switch (this.state) {
        case State.COMPLETE:
          message = i18n('importComplete');
          restartButton = i18n('restartSignal');
          break;
        case State.IMPORTING:
          message = i18n('importing');
          hideProgress = false;
          break;
        default:
          message = i18n('importInstructions');
          importButton = i18n('chooseDirectory');
          cancelButton = i18n('cancel');
      }

      return {
        hideProgress: hideProgress,
        message: message,
        importButton: importButton,
        restartButton: restartButton,
        cancelButton: cancelButton,
      };
    },
    onRestart: function() {
      return window.restart();
    },
    onCancel: function() {
      this.trigger('cancel');
    },
    onImport: function() {
      Whisper.Backup.getDirectoryForImport().then(function(directory) {
        this.doImport(directory);
      }.bind(this), function(error) {
        if (error.name !== 'ChooseError') {
          console.log(
            'Error choosing directory:',
            error && error.stack ? error.stack : error
          );
        }
      });
    },
    doImport: function(directory) {
      this.error = null;

      this.state = State.IMPORTING;
      this.render();

      // Wait for prior database interaction to complete
      this.pending = this.pending.then(function() {
        // For resilience to interruption, clear database both before and on failure
        return Whisper.Backup.clearDatabase();
      }).then(function() {
        return Promise.all([
          Whisper.Import.start(),
          Whisper.Backup.importFromDirectory(directory)
        ]);
      }).then(function() {
        // Catching in-memory cache up with what's in indexeddb now...
        // NOTE: this fires storage.onready, listened to across the app. We'll restart
        //   to complete the install to start up cleanly with everything now in the DB.
        return storage.fetch();
      }).then(function() {
        return Promise.all([
          // Clearing any migration-related state inherited from the Chrome App
          storage.remove('migrationState'),
          storage.remove('migrationEnabled'),
          storage.remove('migrationEverCompleted'),
          storage.remove('migrationStorageLocation'),

          Whisper.Import.saveLocation(directory),
          Whisper.Import.complete()
        ]);
      }).then(function() {
        this.state = State.COMPLETE;
        this.render();
      }.bind(this)).catch(function(error) {
        console.log('Error importing:', error && error.stack ? error.stack : error);

        this.error = error.message;
        this.state = null;
        this.render();

        return Whisper.Backup.clearDatabase();
      }.bind(this));
    }
  });
})();
