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
      this.trigger('install-new');
    },
    onClickImport: function() {
      this.trigger('install-import');
    }
  });
})();
