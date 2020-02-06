/* global Whisper, i18n, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DevicePairingDialogView = Whisper.View.extend({
    className: 'loki-dialog device-pairing-dialog modal',
    initialize(options) {
      this.close = this.close.bind(this);
      this.pubKeyToUnpair = options.pubKeyToUnpair;
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'device-pairing-dialog',
        Component: window.Signal.Components.DevicePairingDialog,
        props: {
          i18n,
          onClose: this.close,
          pubKeyToUnpair: this.pubKeyToUnpair,
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
