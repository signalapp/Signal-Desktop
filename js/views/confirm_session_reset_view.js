/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConfirmSessionResetView = Whisper.View.extend({
    className: 'loki-dialog modal',
    initialize({ pubkey, onOk }) {
      this.title = i18n('couldNotDecryptMessage');

      this.onOk = onOk;
      this.messageText = i18n('confirmSessionRestore', pubkey);
      this.okText = i18n('yes');
      this.cancelText = i18n('cancel');

      this.close = this.close.bind(this);
      this.confirm = this.confirm.bind(this);

      this.$el.focus();
      this.render();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'leave-group-dialog',
        Component: window.Signal.Components.ConfirmDialog,
        props: {
          titleText: this.title,
          messageText: this.messageText,
          okText: this.okText,
          cancelText: this.cancelText,
          onConfirm: this.confirm,
          onClose: this.close,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },
    async confirm() {
      this.onOk();
      this.close();
    },
    close() {
      this.remove();
    },
  });
})();
