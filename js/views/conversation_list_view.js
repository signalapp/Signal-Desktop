/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConversationListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.ConversationListItemView,
        onChangeActiveAt: function(conversation) {
            var $el = this.$('.' + conversation.cid);
            if ($el && $el.length > 0) {
                if (conversation.get('active_at')) {
                    $el.prependTo(this.el);
                } else {
                    var index = getInboxCollection().indexOf(conversation);
                    $el.insertBefore(this.$('.conversation-list-item')[index+1]);
                }
            }
        }
    });
})();
