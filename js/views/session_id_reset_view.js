/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionIDResetDialog = Whisper.View.extend({
    className: 'loki-dialog session-id-reset-dialog modal',
    initialize(options) {
      this.close = this.close.bind(this);
      this.theme = options.theme;
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'session-id-dialog-wrapper',
        Component: window.Signal.Components.SessionIDResetDialog,
        props: {
          onClose: this.close,
          theme: this.theme,
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
