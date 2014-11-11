var Whisper = Whisper || {};

(function () {
  'use strict';

  Whisper.MessageListView = Whisper.ListView.extend({
    tagName: 'ul',
    className: 'discussion',
    itemView: Whisper.MessageView,
    events: {
      'add': 'scrollToBottom'
    },
    scrollToBottom: function() {
        this.$el.scrollTop(this.el.scrollHeight);
    },
  });
})();
