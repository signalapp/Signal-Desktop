/* global Whisper, i18n, QRCode */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.QRDialogView = Whisper.View.extend({
    templateName: 'qr-code-template',
    className: 'loki-dialog qr-dialog modal',
    initialize(options = {}) {
      this.okText = options.okText || i18n('ok');
      this.render();
      this.$('.qr-dialog').bind('keyup', event =>
        this.onKeyup(event)
      );

      if (options.string) {
        this.qr = new QRCode(this.$('#qr')[0]).makeCode(options.string);
        this.$('#qr').addClass('ready');
      }
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
