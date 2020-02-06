/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ScrollDownButtonView = Whisper.View.extend({
    initialize() {},

    render() {
      this.scrollButtonView = new Whisper.ReactWrapperView({
        className: 'module-scroll-down',
        Component: window.Signal.Components.SessionScrollButton,
      });

      this.$el.append(this.scrollButtonView.el);
      return this;
    },
  });
})();
