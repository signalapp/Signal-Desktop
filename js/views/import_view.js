/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  var State = {
    IMPORTING: 1,
    COMPLETE: 2,
    LIGHT_COMPLETE: 3,
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
      return Whisper.Database.clear();
    },
  };

  Whisper.ImportView = Whisper.View.extend({
    templateName: 'import-flow-template',
    className: 'full-screen-flow',
    events: {
      'click .choose': 'onImport',
      'click .restart': 'onRestart',
      'click .cancel': 'onCancel',
      'click .register': 'onRegister',
    },
    initialize: function() {
      if (Whisper.Import.isIncomplete()) {
        this.error = true;
      }

      this.render();
      this.pending = Promise.resolve();
    },
    render_attributes: function() {
      if (this.error) {
        return {
          isError: true,
          errorHeader: i18n('importErrorHeader'),
          errorMessage: i18n('importError'),
          chooseButton: i18n('importAgain'),
        };
      }

      var restartButton = i18n('importCompleteStartButton');
      var registerButton = i18n('importCompleteLinkButton');
      var step = 'step2';

      if (this.state === State.IMPORTING) {
        step = 'step3';
      } else if (this.state === State.COMPLETE) {
        registerButton = null;
        step = 'step4';
      } else if (this.state === State.LIGHT_COMPLETE) {
        restartButton = null;
        step = 'step4';
      }

      return {
        isStep2: step === 'step2',
        chooseHeader: i18n('loadDataHeader'),
        choose: i18n('loadDataDescription'),
        chooseButton: i18n('chooseDirectory'),

        isStep3: step === 'step3',
        importingHeader: i18n('importingHeader'),

        isStep4: step === 'step4',
        completeHeader: i18n('importCompleteHeader'),
        restartButton: restartButton,
        registerButton: registerButton,
      };
    },
    onRestart: function() {
      return window.restart();
    },
    onCancel: function() {
      this.trigger('cancel');
    },
    onImport: function() {
      window.Signal.Backup.getDirectoryForImport().then(
        function(directory) {
          this.doImport(directory);
        }.bind(this),
        function(error) {
          if (error.name !== 'ChooseError') {
            console.log(
              'Error choosing directory:',
              error && error.stack ? error.stack : error
            );
          }
        }
      );
    },
    onRegister: function() {
      // AppView listens for this, and opens up InstallView to the QR code step to
      //   finish setting this device up.
      this.trigger('light-import');
    },

    doImport: function(directory) {
      window.removeSetupMenuItems();

      this.error = null;
      this.state = State.IMPORTING;
      this.render();

      // Wait for prior database interaction to complete
      this.pending = this.pending
        .then(function() {
          // For resilience to interruption, clear database both before and on failure
          return Whisper.Import.reset();
        })
        .then(function() {
          return Promise.all([
            Whisper.Import.start(),
            window.Signal.Backup.importFromDirectory(directory),
          ]);
        })
        .then(
          function(results) {
            var importResult = results[1];

            // A full import changes so much we need a restart of the app
            if (importResult.fullImport) {
              return this.finishFullImport(directory);
            }

            // A light import just brings in contacts, groups, and messages. And we need a
            //   normal link to finish the process.
            return this.finishLightImport(directory);
          }.bind(this)
        )
        .catch(
          function(error) {
            console.log(
              'Error importing:',
              error && error.stack ? error.stack : error
            );

            this.error = error || new Error('Something went wrong!');
            this.state = null;
            this.render();

            return Whisper.Import.reset();
          }.bind(this)
        );
    },
    finishLightImport: function(directory) {
      ConversationController.reset();

      return ConversationController.load()
        .then(function() {
          return Promise.all([
            Whisper.Import.saveLocation(directory),
            Whisper.Import.complete(),
          ]);
        })
        .then(
          function() {
            this.state = State.LIGHT_COMPLETE;
            this.render();
          }.bind(this)
        );
    },
    finishFullImport: function(directory) {
      // Catching in-memory cache up with what's in indexeddb now...
      // NOTE: this fires storage.onready, listened to across the app. We'll restart
      //   to complete the install to start up cleanly with everything now in the DB.
      return storage
        .fetch()
        .then(function() {
          return Promise.all([
            // Clearing any migration-related state inherited from the Chrome App
            storage.remove('migrationState'),
            storage.remove('migrationEnabled'),
            storage.remove('migrationEverCompleted'),
            storage.remove('migrationStorageLocation'),

            Whisper.Import.saveLocation(directory),
            Whisper.Import.complete(),
          ]);
        })
        .then(
          function() {
            this.state = State.COMPLETE;
            this.render();
          }.bind(this)
        );
    },
  });
})();
