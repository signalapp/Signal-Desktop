/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionToggleView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        active: options.active,
      };
    },

    render() {
      this.toggleView = new Whisper.ReactWrapperView({
        className: 'session-toggle-wrapper',
        Component: window.Signal.Components.SessionToggle,
        props: this.props,
      });

      this.$el.append(this.toggleView.el);
    },

    toggle() {
      this.props.active = !this.props.active;
      this.toggleView.update(this.props);
    },
  });
})();
