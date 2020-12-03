/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SeedDialogView = Whisper.View.extend({
    className: 'loki-dialog seed-dialog modal',
    initialize(options) {
      this.close = this.close.bind(this);
      this.theme = options.theme;
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'seed-dialog-wrapper',
        Component: window.Signal.Components.SessionSeedModal,
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
