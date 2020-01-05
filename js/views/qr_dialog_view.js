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
      this.onKeyup = this.onKeyup.bind(this);
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'qr-dialog',
        Component: window.Signal.Components.SessionQRModal,
        props: {
          value: this.value,
        },
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    close() {
      this.remove();
    },
    onKeyup(event) {
      switch (event.key) {
        case 'Enter':
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
