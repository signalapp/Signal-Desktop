/* global i18n: false */
/* global Whisper: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.PasswordView = Whisper.View.extend({
    className: 'password full-screen-flow standalone-fullscreen',
    templateName: 'password',
    events: {
      'click #unlock-button': 'onLogin',
    },
    initialize() {
      this.render();
    },
    render_attributes() {
      return {
        title: i18n('passwordViewTitle'),
        buttonText: i18n('unlock'),
      };
    },
    async onLogin() {
      const passPhrase = this.$('#passPhrase').val();
      const trimmed = passPhrase ? passPhrase.trim() : passPhrase;
      this.setError('');
      try {
        await window.onLogin(trimmed);
      } catch (e) {
        this.setError(`Error: ${e}`);
      }
    },
    setError(string) {
      this.$('.error').text(string);
    },
  });

})();
