/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionConfirmView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        title: options.title,
        message: options.message,
        messageSub: options.messageSub,
        onClickOk: this.ok.bind(this),
        onClickClose: this.cancel.bind(this),
        resolve: options.resolve,
        reject: options.reject,
        okText: options.okText,
        cancelText: options.cancelText,
        okTheme: options.okTheme,
        closeTheme: options.closeTheme,
        hideCancel: options.hideCancel,
      };
    },

    render() {
      this.$('.session-confirm-wrapper').remove();

      this.confirmView = new Whisper.ReactWrapperView({
        className: 'session-confirm-wrapper',
        Component: window.Signal.Components.SessionConfirm,
        props: this.props,
      });

      this.$el.append(this.confirmView.el);
    },

    ok() {
      this.$('.session-confirm-wrapper').remove();
      if (this.props.resolve) {
        this.props.resolve();
      }
    },
    cancel() {
      this.$('.session-confirm-wrapper').remove();
      if (this.props.reject) {
        this.props.reject();
      }
    },
    onKeyup(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        this.cancel();
      }
    },
  });
})();
