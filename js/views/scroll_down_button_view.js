/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.ScrollDownButtonView = Whisper.View.extend({
    className: 'scroll-down-button-view',
    templateName: 'scroll-down-button-view',

    initialize: function(options) {
      options = options || {};
      this.count = options.count || 0;
    },

    increment: function(count) {
      count = count || 0;
      this.count += count;
      this.render();
    },

    render_attributes: function() {
      var cssClass = this.count > 0 ? 'new-messages' : '';

      var moreBelow = i18n('scrollDown');
      if (this.count > 1) {
        moreBelow = i18n('messagesBelow');
      } else if (this.count === 1) {
        moreBelow = i18n('messageBelow');
      }

      return {
        cssClass: cssClass,
        moreBelow: moreBelow,
      };
    },
  });
})();
