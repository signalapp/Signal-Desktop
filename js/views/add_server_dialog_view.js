/* global Whisper, i18n, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AddServerDialogView = Whisper.View.extend({
    className: 'loki-dialog add-server-dialog modal',
    initialize() {
      this.close = this.close.bind(this);
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'add-server-dialog',
        Component: window.Signal.Components.AddServerDialog,
        props: {
          i18n,
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
