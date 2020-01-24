/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ScrollDownButtonView = Whisper.View.extend({
    initialize(options = {}) {
      this.count = options.count || 0;
    },

    increment(count = 0) {
      this.count += count;
      this.render();
    },
    
    render() {
      this.scrollButtonView = new Whisper.ReactWrapperView({
        className: 'module-scroll-down',
        Component: window.Signal.Components.SessionScrollButton,
        props: {
          count: this.count,
        },
      });

      this.$el.append(this.scrollButtonView.el);
      return this;
    },
  });

})();
