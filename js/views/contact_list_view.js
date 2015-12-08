/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ContactListView = Whisper.ListView.extend({
        tagName: 'div',
        itemView: Whisper.View.extend({
            tagName: 'div',
            className: 'contact',
            templateName: 'contact',
            render_attributes: function() {
                return {
                    title: this.model.getTitle(),
                    number: this.model.getNumber(),
                    avatar: this.model.getAvatar()
                };
            }
        })
    });
})();
