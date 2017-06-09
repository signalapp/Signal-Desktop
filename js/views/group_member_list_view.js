/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    // This needs to make each member link to their verification view - except for yourself
    // Do we update the display of each user to add Verified to their name if verified?
    // What about the case where we're brought here because there are multiple users in the no-longer-verified state?
        // We probably want to display some sort of helper text in that case at the least
        // Or do we show only the problematic users in that case?
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
