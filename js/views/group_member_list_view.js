/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.GroupMemberList = Whisper.View.extend({
        className: 'group-member-list',
        template: $('#group-member-list').html(),
        initialize: function() {
            this.render();
            this.member_list_view = new Whisper.ConversationListView({
                collection: this.model.contactCollection,
                className: 'members'
            });
            this.member_list_view.render();
            this.$('.scrollable').append(this.member_list_view.el);
        },
        events: {
            'click .back': 'goBack',
        },
        goBack: function() {
            this.trigger('back');
        },
    });
})();
