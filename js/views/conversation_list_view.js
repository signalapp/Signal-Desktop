/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConversationListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.ConversationListItemView,
        events: {
            'click .contact': 'select',
        },
        select: function(e) {
            var target = $(e.target).closest('.contact');
            target.siblings().removeClass('selected');
            return false;
        }
    });
})();
