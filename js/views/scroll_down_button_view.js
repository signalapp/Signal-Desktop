/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ScrollDownButtonView = Whisper.View.extend({
    className: 'scroll-down-button-view',
    templateName: 'scroll-down-button-view',

    initialize(options = {}) {
      this.count = options.count || 0;
    },

    increment(count = 0) {
      this.count += count;
      this.render();
    },

    render_attributes() {
      const cssClass = this.count > 0 ? 'new-messages' : '';

      let moreBelow = i18n('scrollDown');
      if (this.count > 1) {
        moreBelow = i18n('messagesBelow');
      } else if (this.count === 1) {
        moreBelow = i18n('messageBelow');
      }

      return {
        cssClass,
        moreBelow,
      };
    },
  });
})();
