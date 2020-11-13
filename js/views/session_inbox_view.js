/* global Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InboxView = Whisper.View.extend({
    initialize() {
      this.render();
    },

    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'inbox index',
        Component: window.Signal.Components.SessionInboxView,
      });

      this.$el.append(this.dialogView.el);
      return this;
    },

    close() {
      this.remove();
    },
  });
})();
