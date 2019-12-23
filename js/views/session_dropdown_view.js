/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionDropdownView = Whisper.View.extend({
    initialize(options) {
      this.props = {
        items: options.items,
      };

      this.render();
    },

    render() {
      this.dropdownView = new Whisper.ReactWrapperView({
        className: 'session-dropdown-wrapper',
        Component: window.Signal.Components.SessionDropdown,
        props: this.props,
      });

      this.$el.append(this.dropdownView.el);
    },

    openDropdown() {},

    closeDropdown() {},
  });
})();
