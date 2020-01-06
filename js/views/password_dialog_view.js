/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.PasswordDialogView = Whisper.View.extend({
    className: 'loki-dialog password-dialog modal',
    initialize() {
      this.close = this.close.bind(this);
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'password-dialog-wrapper',
        Component: window.Signal.Components.SessionPasswordChangeModal,
        props: {
          onClose: this.close,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    close() {
      this.remove();
    },
  });
})();
