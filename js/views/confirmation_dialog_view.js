/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConfirmationDialogView = Whisper.View.extend({
    className: 'confirmation-dialog modal',
    templateName: 'confirmation-dialog',
    initialize(options) {
      this.message = options.message;
      this.hideCancel = options.hideCancel;

      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
    },
    render_attributes() {
      return {
        message: this.message,
        showCancel: !this.hideCancel,
        cancel: this.cancelText,
        ok: this.okText,
      };
    },
    ok() {
      this.remove();
      if (this.resolve) {
        this.resolve();
      }
    },
    cancel() {
      this.remove();
      if (this.reject) {
        this.reject();
      }
    },
    onKeyup(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        this.cancel();
      }
    },
    focusCancel() {
      this.$('.cancel').focus();
    },
  });
})();
