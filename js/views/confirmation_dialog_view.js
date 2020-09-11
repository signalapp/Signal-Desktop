/* global Backbone, Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};

  Whisper.ConfirmationDialogView = Whisper.View.extend({
    className: 'confirmation-dialog modal',
    templateName: 'confirmation-dialog',
    initialize(options) {
      this.previousFocus = document.activeElement;

      this.message = options.message;
      this.hideCancel = options.hideCancel;

      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      if (Whisper.activeConfirmationView) {
        Whisper.activeConfirmationView.remove();
        Whisper.activeConfirmationView = null;
      }

      Whisper.activeConfirmationView = this;

      this.render();
    },
    events: {
      keydown: 'onKeydown',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
    },
    remove() {
      if (this.previousFocus && this.previousFocus.focus) {
        this.previousFocus.focus();
      }
      Backbone.View.prototype.remove.call(this);
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
        this.reject(new Error('User clicked cancel button'));
      }
    },
    onKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        this.cancel();

        event.preventDefault();
        event.stopPropagation();
      }
    },
    focusCancel() {
      // We delay this call because we might be called inside click handlers
      //   which would set focus to themselves afterwards!
      setTimeout(() => this.$('.cancel').focus(), 1);
    },
  });
})();
