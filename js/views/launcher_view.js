/* global i18n: false */
/* global Whisper: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.LauncherView = Whisper.View.extend({
    className: 'launcher full-screen-flow standalone-fullscreen',
    templateName: 'launcher',
    events: {
      'click #unlock-button': 'onLogin',
    },
    initialize() {
      this.render();
    },
    render_attributes() {
      return {
        title: i18n('launcherViewTitle'),
        buttonText: i18n('unlock'),
      };
    },
    async onLogin() {
      const passPhrase = this.$('#passPhrase').val();
      this.setError('');
      try {
        await window.onLogin(passPhrase);
      } catch (e) {
        this.setError(`Error: ${e}`);
      }
    },
    setError(string) {
      this.$('.error').text(string);
    },
  });

})();
