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
    addAll: function() {
      this.$el.html('');
      this.collection.each(function(model) {
        var view = new this.itemView({model: model});
        this.$el.prepend(view.render().el);
      }, this);
      this.scrollToBottom();
    },
  });
})();
