/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConversationListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.ConversationListItemView,
        updateLocation: function(conversation) {
            var $el = this.$('.' + conversation.cid);
            if ($el && $el.length > 0) {
                var inboxCollection = getInboxCollection();
                var index = inboxCollection.indexOf(conversation);
                var elIndex = this.$el.index($el);

                if (index === elIndex) {
                    return;
                }
                if (index === 0) {
                    this.$el.prepend($el);
                } else if (index === this.collection.length - 1) {
                    this.$el.append($el);
                } else {
                    var targetConversation = inboxCollection.at(index + 1);
                    var target = this.$('.' + targetConversation.cid);
                    $el.insertBefore(target);
                }
            }
        },
        removeItem: function(conversation) {
            var $el = this.$('.' + conversation.cid);
            if ($el && $el.length > 0) {
                $el.remove();
            }
        }
    });
})();
