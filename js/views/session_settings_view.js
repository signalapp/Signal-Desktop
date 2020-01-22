/* global i18n, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionSettingsView = Whisper.View.extend({
    initialize() {
      this.render();
    },
    render() {
      this.settingsView = new Whisper.ReactWrapperView({
        className: 'session-settings',
        Component: window.Signal.Components.SettingsView,
        props: {
          i18n,
        },
      });

      this.$el.append(this.settingsView.el);
    },
    close() {
      this.remove();
    },
  });
})();
