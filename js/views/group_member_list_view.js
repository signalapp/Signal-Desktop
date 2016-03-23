/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.GroupMemberList = Whisper.View.extend({
        className: 'group-member-list panel',
        templateName: 'group-member-list',
        initialize: function() {
            this.render();
            this.member_list_view = new Whisper.ContactListView({
                collection: this.model.contactCollection,
                className: 'members'
            });
            this.member_list_view.render();
            this.$('.container').append(this.member_list_view.el);
        },
        render_attributes: {
            members: i18n('members')
        }
    });
})();
