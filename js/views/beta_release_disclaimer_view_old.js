/* global Whisper, i18n, window */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.BetaReleaseDisclaimer = Whisper.View.extend({
    className: 'loki-dialog beta-disclaimer-dialog modal',
    templateName: 'beta-disclaimer-dialog',
    initialize(options = {}) {
      this.okText = options.okText || i18n('ok');
      this.render();
      this.$('.betaDisclaimerView').show();
      this.$('.beta-disclaimer-dialog').bind('keyup', event =>
        this.onKeyup(event)
      );
    },
    events: {
      'click .ok': 'close',
    },
    render_attributes() {
      return {
        ok: this.okText,
      };
    },
    close() {
      window.storage.put('betaReleaseDisclaimerAccepted', true);
      this.remove();
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Enter':
        case 'Escape':
        case 'Esc':
          this.close();
          break;
        default:
          break;
      }
    },
  });
})();
