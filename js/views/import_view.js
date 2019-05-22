/* global Whisper, storage, i18n, ConversationController */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const State = {
    IMPORTING: 1,
    COMPLETE: 2,
    LIGHT_COMPLETE: 3,
  };

  const IMPORT_STARTED = 'importStarted';
  const IMPORT_COMPLETE = 'importComplete';
  const IMPORT_LOCATION = 'importLocation';

  Whisper.Import = {
    isStarted() {
      return Boolean(storage.get(IMPORT_STARTED));
    },
    isComplete() {
      return Boolean(storage.get(IMPORT_COMPLETE));
    },
    isIncomplete() {
      return this.isStarted() && !this.isComplete();
    },
    start() {
      return storage.put(IMPORT_STARTED, true);
    },
    complete() {
      return storage.put(IMPORT_COMPLETE, true);
    },
    saveLocation(location) {
      return storage.put(IMPORT_LOCATION, location);
    },
    reset() {
      return window.Signal.Data.removeAll();
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
    initialize() {
      if (Whisper.Import.isIncomplete()) {
        this.error = true;
      }

      this.render();
      this.pending = Promise.resolve();
    },
    render_attributes() {
      if (this.error) {
        return {
          isError: true,
          errorHeader: i18n('importErrorHeader'),
          errorMessageFirst: i18n('importErrorFirst'),
          errorMessageSecond: i18n('importErrorSecond'),
          chooseButton: i18n('importAgain'),
        };
      }

      let restartButton = i18n('importCompleteStartButton');
      let registerButton = i18n('importCompleteLinkButton');
      let step = 'step2';

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
        restartButton,
        registerButton,
      };
    },
    onRestart() {
      return window.restart();
    },
    onCancel() {
      this.trigger('cancel');
    },
    onImport() {
      window.Signal.Backup.getDirectoryForImport().then(
        directory => {
          this.doImport(directory);
        },
        error => {
          if (error.name !== 'ChooseError') {
            window.log.error(
              'Error choosing directory:',
              error && error.stack ? error.stack : error
            );
          }
        }
      );
    },
    onRegister() {
      // AppView listens for this, and opens up InstallView to the QR code step to
      //   finish setting this device up.
      this.trigger('light-import');
    },

    doImport(directory) {
      window.removeSetupMenuItems();

      this.error = null;
      this.state = State.IMPORTING;
      this.render();

      // Wait for prior database interaction to complete
      this.pending = this.pending
        .then(() =>
          // For resilience to interruption, clear database both before and on failure
          Whisper.Import.reset()
        )
        .then(() =>
          Promise.all([
            Whisper.Import.start(),
            window.Signal.Backup.importFromDirectory(directory),
          ])
        )
        .then(results => {
          const importResult = results[1];

          // A full import changes so much we need a restart of the app
          if (importResult.fullImport) {
            return this.finishFullImport(directory);
          }

          // A light import just brings in contacts, groups, and messages. And we need a
          //   normal link to finish the process.
          return this.finishLightImport(directory);
        })
        .catch(error => {
          window.log.error(
            'Error importing:',
            error && error.stack ? error.stack : error
          );

          this.error = error || new Error('Something went wrong!');
          this.state = null;
          this.render();

          return Whisper.Import.reset();
        });
    },
    finishLightImport(directory) {
      ConversationController.reset();

      return ConversationController.load()
        .then(() =>
          Promise.all([
            Whisper.Import.saveLocation(directory),
            Whisper.Import.complete(),
          ])
        )
        .then(() => {
          this.state = State.LIGHT_COMPLETE;
          this.render();
        });
    },
    finishFullImport(directory) {
      // Catching in-memory cache up with what's in indexeddb now...
      // NOTE: this fires storage.onready, listened to across the app. We'll restart
      //   to complete the install to start up cleanly with everything now in the DB.
      return storage
        .fetch()
        .then(() =>
          Promise.all([
            // Clearing any migration-related state inherited from the Chrome App
            storage.remove('migrationState'),
            storage.remove('migrationEnabled'),
            storage.remove('migrationEverCompleted'),
            storage.remove('migrationStorageLocation'),

            Whisper.Import.saveLocation(directory),
            Whisper.Import.complete(),
          ])
        )
        .then(() => {
          this.state = State.COMPLETE;
          this.render();
        });
    },
  });
})();
