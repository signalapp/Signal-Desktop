/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.InstallChoiceView = Whisper.View.extend({
    templateName: 'install-choice',
    className: 'install install-choice',
    events: {
      'click .new': 'onClickNew',
      'click .import': 'onClickImport'
    },
    initialize: function() {
      this.render();
    },
    render_attributes: {
      installWelcome: i18n('installWelcome'),
      installTagline: i18n('installTagline'),
      installNew: i18n('installNew'),
      installImport: i18n('installImport')
    },
    onClickNew: function() {
      var startProcess = function() {
        this.trigger('install-new');
      }.bind(this);

      // Clear the database before starting the registration process
      //   This is primarily to protect against partial light import processes where
      //   The user imported all messages/etc., but didn't finish registration.
      Whisper.Backup.clearDatabase().then(startProcess, function(error) {
        console.log(
          'onClickNew: error clearing database',
          error && error.stack ? error.stack : error
        );
        startProcess();
      });
    },
    onClickImport: function() {
      this.trigger('install-import');
    }
  });
})();
