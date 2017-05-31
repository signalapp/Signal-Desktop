/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var FIVE_SECONDS = 5 * 1000;

    Whisper.LastSeenIndicatorView = Whisper.View.extend({
        className: 'last-seen-indicator-view',
        templateName: 'last-seen-indicator-view',
        initialize: function(options) {
          options = options || {};
          this.count = options.count || 0;
          this.start = Date.now();
        },

        isOldEnough: function() {
          var now = Date.now();
          if (now - this.start > FIVE_SECONDS) {
            return true;
          }
        },

        increment: function(count) {
            this.count += count;
            this.render();
        },

        render_attributes: function() {
            var unreadMessages = this.count === 1 ? i18n('unreadMessage')
              : i18n('unreadMessages', [this.count]);

            return {
              unreadMessages: unreadMessages
            };
        }
    });
})();
