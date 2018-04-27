/*
 * vim: ts=4:sw=4:expandtab
 */
(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.ConversationListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.ConversationListItemView,
    updateLocation: function(conversation) {
      var $el = this.$('.' + conversation.cid);

      if (!$el || !$el.length) {
        console.log(
          'updateLocation: did not find element for conversation',
          conversation.idForLogging()
        );
        return;
      }
      if ($el.length > 1) {
        console.log(
          'updateLocation: found more than one element for conversation',
          conversation.idForLogging()
        );
        return;
      }

      var $allConversations = this.$('.conversation-list-item');
      var inboxCollection = getInboxCollection();
      var index = inboxCollection.indexOf(conversation);

      var elIndex = $allConversations.index($el);
      if (elIndex < 0) {
        console.log(
          'updateLocation: did not find index for conversation',
          conversation.idForLogging()
        );
      }

      if (index === elIndex) {
        return;
      }
      if (index === 0) {
        this.$el.prepend($el);
      } else if (index === this.collection.length - 1) {
        this.$el.append($el);
      } else {
        var targetConversation = inboxCollection.at(index - 1);
        var target = this.$('.' + targetConversation.cid);
        $el.insertAfter(target);
      }
    },
    removeItem: function(conversation) {
      var $el = this.$('.' + conversation.cid);
      if ($el && $el.length > 0) {
        $el.remove();
      }
    },
  });
})();
