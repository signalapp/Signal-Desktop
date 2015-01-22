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

    Whisper.InboxView = Backbone.View.extend({
        initialize: function () {
            this.gutter = $('#gutter');
            this.contacts = $('#contacts');

            this.conversations = new Whisper.ConversationCollection();

            new Whisper.ConversationListView({
                el         : $('#contacts'),
                collection : this.conversations
            });

            this.conversations.fetchActive({reset: true});

            extension.on('message', function(message) {
                this.conversations.fetch({id: message.conversationId}).then(function() {
                    this.conversations.get(message.conversationId).fetchMessages();
                }.bind(this));
            }.bind(this));
        },
        events: {
            'click #new-message': 'new_message',
            'click #new-group': 'new_group'
        },
        new_message: function (e) {
            e.preventDefault();
            $('.conversation').hide().trigger('close'); // detach any existing conversation views
            this.view = new Whisper.NewConversationView({
                collection: this.conversations
            });
            this.setContent(this.view.render().$el.show());
        },
        new_group: function (e) {
            e.preventDefault();
            $('.conversation').trigger('close'); // detach any existing conversation views
            var view = new Whisper.NewGroupView({
                collection: this.conversations
            });
            this.setContent(view.render().$el.show());
        },
        setContent: function (content) {
            $(content).insertAfter(this.gutter);
        }
    });

})();
