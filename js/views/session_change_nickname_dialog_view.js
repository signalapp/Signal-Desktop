/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionNicknameDialog = Whisper.View.extend({
    className: 'loki-dialog session-nickname-wrapper modal',
    initialize(options) {
      this.props = {
        title: options.title,
        message: options.message,
        onClickOk: this.ok.bind(this),
        onClickClose: this.cancel.bind(this),
        convoId: options.convoId,
        placeholder: options.placeholder,
      };
      this.render();
    },
    registerEvents() {
      this.unregisterEvents();
      document.addEventListener('keyup', this.props.onClickClose, false);
    },

    unregisterEvents() {
      document.removeEventListener('keyup', this.props.onClickClose, false);
      this.$('session-nickname-wrapper').remove();
    },
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'session-nickname-wrapper',
        Component: window.Signal.Components.SessionNicknameDialog,
        props: this.props,
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    close() {
      this.remove();
    },
    cancel() {
      this.remove();
      this.unregisterEvents();
    },
    ok() {
      this.remove();
      this.unregisterEvents();
    },
  });
})();
