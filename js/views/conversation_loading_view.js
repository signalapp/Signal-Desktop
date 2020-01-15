/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConversationLoadingScreen = Whisper.View.extend({
    initialize() {},

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'app-loading-wrapper',
        Component: window.Signal.Components.ConversationLoadingScreen,
        props: this.props,
      });

      this.$el.append(this.dialogView.el);
    },
  });
})();
