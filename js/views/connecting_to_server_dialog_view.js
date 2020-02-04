/* global Whisper, i18n, log */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConnectingToServerDialogView = Whisper.View.extend({
    templateName: 'connecting-to-server-template',
    className: 'loki-dialog connecting-to-server modal',
    initialize(options = {}) {
      this.title = i18n('connectingLoad');
      this.cancelText = options.cancelText || i18n('cancel');
      this.serverUrl = options.serverUrl;
      this.channelId = options.channelId;
      this.once('attemptConnection', () =>
        this.attemptConnection(options.serverUrl, options.channelId)
      );
      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .cancel': 'close',
    },
    async attemptConnection(serverUrl, channelId) {
      let conversation = null;
      try {
        conversation = await window.attemptConnection(serverUrl, channelId);
      } catch (e) {
        log.error('can not connect', e.message, e.code);
        return this.resolveWith({ errorCode: e.message });
      }
      return this.resolveWith({ conversation });
    },
    resolveWith(result) {
      this.trigger('connectionResult', result);
      this.remove();
    },
    render_attributes() {
      return {
        title: this.title,
        cancel: this.cancelText,
      };
    },
    close() {
      this.trigger('connectionResult', { cancelled: true });
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
