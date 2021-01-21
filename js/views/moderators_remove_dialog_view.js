/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.RemoveModeratorsDialogView = Whisper.View.extend({
    className: 'loki-dialog modal',
    async initialize(convo) {
      this.close = this.close.bind(this);
      this.convo = convo;

      this.$el.focus();
      this.render();
    },
    render() {
      const view = new Whisper.ReactWrapperView({
        className: 'remove-moderators-dialog',
        Component: window.Signal.Components.RemoveModeratorsDialog,
        props: {
          onClose: this.close,
          convo: this.convo,
          theme: this.convo.theme,
        },
      });

      this.$el.append(view.el);
      return this;
    },
    close() {
      this.remove();
    },
  });
})();
