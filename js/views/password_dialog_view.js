/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.PasswordDialogView = Whisper.View.extend({
    className: 'loki-dialog password-dialog modal',
    initialize(options) {
      this.close = this.close.bind(this);
      this.onOk = this.onOk.bind(this);
      this.props = options;

      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'password-dialog-wrapper',
        Component: window.Signal.Components.SessionPasswordModal,
        props: {
          onClose: this.close,
          onOk: this.onOk,
          ...this.props,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    onOk(action) {
      if (this.props.onSuccess) {
        this.props.onSuccess(action);
      }
    },

    close() {
      this.remove();
    },
  });
})();
