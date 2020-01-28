/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.PasswordView = Whisper.View.extend({
    initialize() {
      this.render();
    },

    render() {
      this.passwordView = new window.Whisper.ReactWrapperView({
        className: 'password overlay',
        Component: window.Signal.Components.SessionPasswordPrompt,
        props: {},
      });

      this.$el.append(this.passwordView.el);
      return this;
    },
  });
})();
