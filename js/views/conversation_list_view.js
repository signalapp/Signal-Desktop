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
            console.log('sorting conversation', conversation.id);
            var $el = this.$('.' + conversation.cid);
            if ($el && $el.length > 0) {
                var index = getInboxCollection().indexOf(conversation);
                if (index > 0) {
                    $el.insertBefore(this.$('.conversation-list-item')[index+1]);
                } else {
                    this.$el.prepend($el);
                }
            }
        }
    });
})();
