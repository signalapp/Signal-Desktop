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
      // Remove error if there is one
      this.showError(null);
      const serverUrl = this.$('#server-url').val().toLowerCase();
      // TODO: Make this not hard coded
      const channelId = 1;
      const dialog = new Whisper.ConnectingToServerDialogView({
        serverUrl,
        channelId,
      });
      const dialogDelayTimer = setTimeout(() => {
        this.el.append(dialog.el);
      }, 200);
      dialog.once('connectionResult', result => {
        clearTimeout(dialogDelayTimer);
        if (result.cancelled) {
          this.showError(null);
          return;
        }
        if (result.errorCode) {
          this.showError(result.errorCode);
          return;
        }
        window.Whisper.events.trigger('showToast', {
          message: i18n('connectToServerSuccess'),
        });
        this.close();
      });
      dialog.trigger('attemptConnection');
    },
    close() {
      this.remove();
    },
    showError(message) {
      if (_.isEmpty(message)) {
        this.$('.error').text('');
        this.$('.error').hide();
      } else {
        this.$('.error').text(`Error: ${message}`);
        this.$('.error').show();
      }
      this.$('input').focus();
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
