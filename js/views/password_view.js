/* global i18n: false */
/* global Whisper: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const MIN_LOGIN_TRIES = 3;

  Whisper.PasswordView = Whisper.View.extend({
    className: 'password full-screen-flow standalone-fullscreen',
    templateName: 'password',
    events: {
      keyup: 'onKeyup',
      'click #unlock-button': 'onLogin',
      'click #reset-button': 'onReset',
    },
    initialize() {
      this.errorCount = 0;
      this.render();
    },
    render_attributes() {
      return {
        title: i18n('passwordViewTitle'),
        buttonText: i18n('unlock'),
        resetText: i18n('resetDatabase'),
        showReset: this.errorCount >= MIN_LOGIN_TRIES,
      };
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Enter':
          this.onLogin();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    async onLogin() {
      const passPhrase = this.$('#passPhrase').val();
      const trimmed = passPhrase ? passPhrase.trim() : passPhrase;
      this.setError('');
      try {
        await window.onLogin(trimmed);
      } catch (e) {
        // Increment the error counter and show the button if necessary
        this.errorCount += 1;
        if (this.errorCount >= MIN_LOGIN_TRIES) {
          this.render();
        }

        this.setError(`Error: ${e}`);
      }
    },
    setError(string) {
      this.$('.error').text(string);
    },
    onReset() {
      const clearDataView = new window.Whisper.ClearDataView(() => {
        window.resetDatabase();
      });
      clearDataView.render();
      this.$el.append(clearDataView.el);
    },
  });
})();
