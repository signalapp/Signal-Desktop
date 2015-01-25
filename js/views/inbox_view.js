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

    var typeahead = Backbone.TypeaheadCollection.extend({
        typeaheadAttributes: ['name'],
        database: Whisper.Database,
        storeName: 'conversations',
        model: Whisper.Conversation,

        comparator: function(m) {
            return m.get('name');
        },
    });

    Whisper.InboxView = Backbone.View.extend({
        initialize: function () {
            this.gutter = $('#gutter');
            this.contacts = $('#contacts');

            this.typeahead_collection = new typeahead();
            this.typeahead_view = new Whisper.ConversationListView({
                collection : new Whisper.ConversationCollection()
            });
            this.typeahead_view.$el.hide().insertAfter(this.contacts);
            this.typeahead_collection.fetch();

            this.conversations = new Whisper.ConversationCollection();
            this.inbox = new Whisper.ConversationListView({
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
            'click #new-group': 'new_group',
            'change input.new-message': 'filterContacts',
            'keyup input.new-message': 'filterContacts'
        },
        filterContacts: function() {
            var query = this.$el.find('input.new-message').val();
            if (query.length) {
                this.typeahead_view.collection.reset(
                    this.typeahead_collection.typeahead(query)
                );
                this.contacts.hide();
                this.typeahead_view.$el.show();

            } else {
                this.contacts.show();
                this.typeahead_view.$el.hide();
            }
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
