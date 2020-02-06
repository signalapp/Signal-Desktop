/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.QRDialogView = Whisper.View.extend({
    className: 'loki-dialog qr-dialog modal',
    initialize(options) {
      this.value = options.value || '';
      this.close = this.close.bind(this);

      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'qr-dialog-wrapper',
        Component: window.Signal.Components.SessionQRModal,
        props: {
          value: this.value,
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
