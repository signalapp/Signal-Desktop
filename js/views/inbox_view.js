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
    var bg = extension.windows.getBackground();

    Whisper.InboxView = Backbone.View.extend({
        initialize: function () {
            this.$gutter = $('#gutter');
            this.$contacts = $('#contacts');
            this.$fab = this.$el.find('.fab');
            this.$back = this.$el.find('.back');

            this.newConversationView = new Whisper.NewConversationView();
            this.newConversationView.$el.hide().appendTo(this.$gutter);

            this.conversations = new Whisper.ConversationCollection();
            this.inbox = new Whisper.ConversationListView({
                el         : this.$contacts,
                collection : this.conversations
            });

            this.$el.addClass('loading');
            this.conversations.fetchActive({reset: true}).then(function() {
                this.$el.removeClass('loading');
            }.bind(this));

            extension.on('message', function(message) {
                this.conversations.fetch({id: message.conversationId}).then(function() {
                    this.conversations.get(message.conversationId).fetchMessages();
                }.bind(this));
            }.bind(this));
        },
        events: {
            'click .back button': 'hideCompose',
            'click .fab': 'showCompose',
            'keyup input.new-message': 'compose',
            'open .contact': 'openConversation'
        },
        openConversation: function(e, data) {
            bg.openConversation(data.modelId);
        },
        showCompose: function() {
            this.$fab.hide();
            this.$contacts.hide();
            this.newConversationView.reset();
            this.newConversationView.$el.show();
            this.$back.show();
        },
        hideCompose: function() {
            this.newConversationView.$el.hide();
            this.$contacts.show();
            this.$fab.show();
            this.$back.hide();
        },
        compose: function(e) {
            if (e.keyCode === 27) {
                this.hideCompose();
            }
        }
    });

})();
