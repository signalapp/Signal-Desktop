;(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  var LinuxInstructionsView = Whisper.ConfirmationDialogView.extend({
    className: 'linux-install-instructions',
    templateName: 'linux-install-instructions',
    _super: Whisper.ConfirmationDialogView.prototype,
    initialize: function() {
      this._super.initialize.call(this, {
        okText: i18n('close'),
      });
    },
    events: {
      'keyup': 'onKeyup',
      'click .ok': 'ok',
      'click .modal': 'ok',
    },
    render_attributes: function() {
      var attributes = this._super.render_attributes.call(this);
      // TODO: i18n
      attributes.header = 'Debian-based Linux install instructions';
      return attributes;
    },
    ok: function(event) {
      // We have an event on .modal, which is the background div, darkening the screen.
      //   This ensures that a click on the dialog will not fire that event, by checking
      //   the actual thing clicked against the target.
      if (event.target !== event.currentTarget) {
        return;
      }

      this._super.ok.call(this);
    }
  });

  var State = {
    DISCONNECTING: 1,
    EXPORTING: 2,
    COMPLETE: 3,
  };

  var STEPS = {
    INTRODUCTION: 1,
    CHOOSE: 2,
    EXPORTING: 3,
    COMPLETE: 4,
  };

  var GET_YAML_PATH = /^path: (.+)$/m;
  var BASE_PATH = 'https://updates.signal.org/desktop/';

  function getCacheBuster() {
    return Math.random().toString(36).substring(7);
  }

  function getLink(file) {
    return new Promise(function(resolve, reject) {
      $.get(BASE_PATH + file + '?b=' + getCacheBuster())
        .done(function(data) {
          var match = GET_YAML_PATH.exec(data);
          if (match && match[1]) {
            return resolve(BASE_PATH + match[1]);
          }

          return reject(new Error('Link not found in YAML from ' + file + ': ' + data));
        })
        .fail(function(xhr) {
          return reject(new Error(
            'Problem pulling ' + file + '; Request Status: ' + xhr.status +
            ' Status Text: ' + xhr.statusText + ' ' + xhr.responseText)
          );
        });
    });
  }

  function getMacLink() {
    return getLink('latest-mac-import.yml');
  }

  function getWindowsLink() {
    return getLink('latest-import.yml');
  }

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
      return Promise.all([
        storage.remove('migrationState'),
        storage.remove('migrationEverCompleted'),
        storage.remove('migrationStorageLocation')
      ]);
    },
    beginExport: function() {
      storage.put('migrationState', State.EXPORTING);

      var everAttempted = this.everAttempted();
      storage.put('migrationEverAttempted', true);

      // If this is the second time the user is attempting to export, we'll exclude
      //   client-specific encryption configuration. Yes, this will fire if the user
      //   initially attempts to save to a read-only directory or something like that, but
      //   it will prevent the horrible encryption errors which result from import to the
      //   same client config more than once. They can import the same message history
      //   more than once, so we preserve that.
      return Whisper.Backup.exportToDirectory({
        excludeClientConfig: everAttempted,
      });
    },
    init: function() {
      storage.put('migrationState', State.DISCONNECTING);
      Whisper.events.trigger('start-shutdown');
    },
    everAttempted: function() {
      return Boolean(storage.get('migrationEverAttempted'));
    },
    everComplete: function() {
      return Boolean(storage.get('migrationEverCompleted'));
    },
    getExportLocation: function() {
      return storage.get('migrationStorageLocation');
    }
  };

  Whisper.MigrationView = Whisper.View.extend({
    templateName: 'migration-flow-template',
    className: 'migration-flow',
    events: {
      'click .start': 'onClickStart',
      'click .choose': 'onClickChoose',
      'click .submit-debug-log': 'onClickDebugLog',
      'click .cancel': 'onClickCancel',
      'click .get-new-version': 'onGetNewVersion',
    },
    initialize: function() {
      this.step = STEPS.INTRODUCTION;

      // init() tells MessageReceiver to disconnect and drain its queue, will fire
      //   'shutdown-complete' event when that is done. Might result in a synchronous
      //   event, so call it after we register our callback.
      Whisper.events.once('shutdown-complete', function() {
        this.shutdownComplete = true;
      }.bind(this));
      Whisper.Migration.init();

      Promise.all([getMacLink(), getWindowsLink()]).then(function(results) {
        this.macLink = results[0];
        this.windowsLink = results[1];
        this.render();
      }.bind(this), function(error) {
        console.log(
          'MigrationView: Ran into problem pulling Mac/Windows install links:',
          error.stack
        );
      });

      if (!Whisper.Migration.inProgress()) {
        this.render();
        return;
      }

      // We could be wedged in an 'in progress' state, the migration was started then the
      //   app restarted in the middle.
      if (Whisper.Migration.everComplete()) {
        // If the user has ever successfully exported before, we'll show the 'finished'
        //   screen with the 'Export again' button.
        this.step = STEPS.COMPLETE;
        Whisper.Migration.markComplete();
      }

      this.render();
    },
    render_attributes: function() {
      if (this.error) {
        return {
          isError: true,
          errorHeader: i18n('exportErrorHeader'),
          error: i18n('exportError'),
          tryAgain: i18n('chooseFolderAndTryAgain'),
          debugLogButton: i18n('submitDebugLog'),
        };
      }

      var location = Whisper.Migration.getExportLocation() || i18n('selectedLocation');

      var userAgent = navigator.userAgent.toLowerCase();
      var downloadLocation = '#';
      if (userAgent.indexOf('windows') !== -1) {
        downloadLocation = this.windowsLink;
      } else if (userAgent.indexOf('macintosh') !== -1) {
        downloadLocation = this.macLink;
      } else {
        downloadLocation = 'https://signal.org/download';
      }

      return {
        cancelButton: i18n('upgradeLater'),
        debugLogButton: i18n('submitDebugLog'),

        isStep1: this.step === 1,
        startHeader: i18n('startExportHeader'),
        startParagraph1: i18n('startExportIntroParagraph1'),
        startParagraph2: i18n('startExportIntroParagraph2'),
        startParagraph3: i18n('startExportIntroParagraph3'),
        moreInformation: i18n('moreInformation'),
        startButton: i18n('imReady'),

        isStep2: this.step === 2,
        chooseHeader: i18n('saveHeader'),
        choose: i18n('saveDataPrompt'),
        chooseButton: i18n('chooseFolder'),

        isStep3: this.step === 3,
        exportHeader: i18n('savingData'),

        isStep4: this.step === 4,
        completeHeader: i18n('completeHeader'),
        completeIntro: i18n('completeIntro'),
        completeLocation: location,
        completeNextSteps: i18n('completeNextSteps'),
        downloadLocation: downloadLocation,
        installButton: i18n('getNewVersion'),
      };
    },
    onGetNewVersion: function(e) {
      var userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.indexOf('linux') !== -1) {
        e.preventDefault();

        var dialog = this.linuxInstructionsView = new LinuxInstructionsView({});
        this.$el.prepend(dialog.el);
        dialog.focusOk();
      }
    },
    onClickStart: function() {
      this.selectStep(STEPS.CHOOSE);
    },
    onClickChoose: function() {
      this.error = null;

      if (!this.shutdownComplete) {
        console.log("Preventing export start; we haven't disconnected from the server");
        this.error = true;
        this.render();
        return;
      }

      if (!Whisper.Migration.everComplete()) {
        return this.beginMigration();
      }

      // Different behavior for the user's second time through
      this.selectStep(STEPS.EXPORTING);
      Whisper.Migration.beginExport()
        .then(this.completeMigration.bind(this))
        .catch(function(error) {
          if (!error || error.name !== 'ChooseError') {
            this.error = error || new Error('in case we reject() null!');
          }
          // Even if we run into an error, we call this complete because the user has
          //   completed the process once before.
          Whisper.Migration.markComplete();
          this.selectStep(STEPS.COMPLETE);
        }.bind(this));
      this.render();
    },
    onClickCancel: function() {
      this.cancel();
    },
    onClickDebugLog: function() {
      this.openDebugLog();
    },

    cancel: function() {
      Whisper.Migration.cancel().then(function() {
        console.log('Restarting now');
        window.location.reload();
      });
    },
    selectStep: function(step) {
      this.step = step;
      this.render();
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

    beginMigration: function() {
      this.selectStep(STEPS.EXPORTING);

      Whisper.Migration.beginExport()
        .then(this.completeMigration.bind(this))
        .catch(function(error) {
          // We ensure that a restart of the app acts as if the user never tried
          //   to export.
          Whisper.Migration.cancel();

          // We special-case the error we get when the user cancels out of the
          //   filesystem choice dialog: it's not shown an error.
          if (!error || error.name !== 'ChooseError') {
            this.error = error || new Error('in case we reject() null!');
          }

          // Because this is our first time attempting to export, we go back to
          //   the choice step. Compare this to the end of onClickChoose().
          this.selectStep(STEPS.CHOOSE);
        }.bind(this));
    },
    completeMigration: function(target) {
      // This will prevent connection to the server on future app launches
      Whisper.Migration.markComplete(target);
      this.selectStep(STEPS.COMPLETE);
    },
  });
}());

