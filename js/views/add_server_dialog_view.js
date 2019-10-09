/* global Whisper, i18n, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AddServerDialogView = Whisper.View.extend({
    templateName: 'add-server-template',
    className: 'loki-dialog add-server modal',
    initialize(options = {}) {
      this.title = i18n('addServerDialogTitle');
      this.okText = options.okText || i18n('ok');
      this.cancelText = options.cancelText || i18n('cancel');
      this.$('input').focus();
      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'confirm',
      'click .cancel': 'close',
    },
    render_attributes() {
      return {
        title: this.title,
        ok: this.okText,
        cancel: this.cancelText,
      };
    },
    confirm() {
      const serverUrl = this.$('#server-url').val();
      console.log(`You confirmed the adding of a new server: ${serverUrl}`);
      const dialog = new Whisper.ConnectingToServerDialogView({ serverUrl });
      this.el.append(dialog.el);
    },
    async validateServer() {
    },
    close() {
      this.remove();
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Enter':
          this.confirm();
          break;
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
