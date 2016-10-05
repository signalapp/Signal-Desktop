/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConversationListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.ConversationListItemView,
        sort: function(conversation) {
            var $el = this.$('.' + conversation.cid);
            if ($el && $el.length > 0) {
                var index = getInboxCollection().indexOf(conversation);
                if (index === this.$el.index($el)) {
                    return;
                }
                if (index === 0) {
                    this.$el.prepend($el);
                } else if (index === this.collection.length - 1) {
                    this.$el.append($el);
                } else {
                    $el.insertBefore(this.$('.conversation-list-item')[index+1]);
                }
            }
        }
    });
})();
