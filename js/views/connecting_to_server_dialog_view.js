/* global Whisper, i18n, QRCode, lokiPublicChatAPI */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConnectingToServerDialogView = Whisper.View.extend({
    templateName: 'connecting-to-server-template',
    className: 'loki-dialog connecting-to-server modal',
    initialize(options = {}) {
      console.log(`Add server init: ${options}`);
      this.title =  i18n('loading');
      this.cancelText = options.cancelText || i18n('cancel');
      this.render();
      this.$('.connecting-to-server').bind('keyup', event => this.onKeyup(event));
      const serverAPI = lokiPublicChatAPI.findOrCreateServer(
        options.serverUrl
      );
    },
    events: {
      'click .cancel': 'close',
    },
    render_attributes() {
      return {
        title: this.title,
        cancel: this.cancelText,
      };
    },
    close() {
      this.remove();
    },
    onKeyup(event) {
      switch (event.key) {
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


