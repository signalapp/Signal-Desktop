/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.LastSeenIndicatorView = Whisper.View.extend({
    className: 'last-seen-indicator-view',
    templateName: 'last-seen-indicator-view',
    initialize(options = {}) {
      this.count = options.count || 0;
    },

    increment(count) {
      this.count += count;
      this.render();
    },

    getCount() {
      return this.count;
    },

    render_attributes() {
      const unreadMessages =
        this.count === 1
          ? i18n('unreadMessage')
          : i18n('unreadMessages', [this.count]);

      return {
        unreadMessages,
      };
    },
  });
})();
