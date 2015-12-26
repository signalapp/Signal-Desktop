/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.GroupMemberList = Whisper.View.extend({
        className: 'group-member-list',
        templateName: 'group-member-list',
        initialize: function() {
            this.render();
            this.member_list_view = new Whisper.ContactListView({
                collection: this.model.contactCollection,
                className: 'members'
            });
            this.member_list_view.render();
            this.$('.scrollable').append(this.member_list_view.el);
        },
        render_attributes: {
            members: i18n('members')
        },
        events: {
            'click .back': 'goBack',
        },
        goBack: function() {
            this.trigger('back');
        },
    });
})();
