var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.MessageListView = Whisper.ListView.extend({
    tagName: 'ul',
    className: 'discussion',
    itemView: Whisper.MessageView,
    events: {
      'add': 'scrollToBottom',
      'update *': 'scrollToBottom'
    },
    scrollToBottom: function() {
        // TODO: Avoid scrolling if user has manually scrolled up?
        this.$el.scrollTop(this.el.scrollHeight);
    },
    addAll: function() {
      Whisper.ListView.prototype.addAll.apply(this, arguments); // super()
      this.scrollToBottom();
    },
  });
})();
