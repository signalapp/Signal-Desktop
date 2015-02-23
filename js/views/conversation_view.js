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

    Whisper.ConversationView = Backbone.View.extend({
        className: function() {
            return [ 'conversation', this.model.get('type') ].join(' ');
        },
        initialize: function() {
            this.listenTo(this.model, 'destroy', this.stopListening); // auto update
            this.template = $('#conversation').html();
            Mustache.parse(this.template);

            this.$el.html(Mustache.render(this.template,
                { group: this.model.get('type') === 'group' }
            ));

            this.fileInput = new Whisper.FileInputView({
                el: this.$el.find('.attachments')
            });

            this.view = new Whisper.MessageListView({
                collection: this.model.messageCollection
            });
            this.$el.find('.discussion-container').append(this.view.el);
            this.view.render();

            setTimeout(function() {
                this.view.scrollToBottom();
            }.bind(this), 10);
        },

        events: {
            'submit .send': 'sendMessage',
            'close': 'remove',
            'click .destroy': 'destroyMessages',
            'click .end-session': 'endSession',
            'click .leave-group': 'leaveGroup',
            'click .new-group-update': 'newGroupUpdate',
            'click .hamburger': 'toggleMenu',
            'click' : 'closeMenu',
            'select .entry': 'messageDetail'
        },

        messageDetail: function(e, data) {
            var view = new Whisper.MessageDetailView({ model: data.message, conversation: this.model });
            view.$el.insertAfter(this.$el);
            this.$el.hide();
            view.render();
            this.listenTo(view, 'back', function() {
                view.remove();
                this.$el.show();
            }.bind(this));
        },

        closeMenu: function(e) {
            if (e && !$(e.target).hasClass('hamburger')) {
                this.$el.find('.menu-list').hide();
            }
        },

        endSession: function() {
            this.model.endSession();
            this.$el.find('.menu-list').hide();
        },

        leaveGroup: function() {
            this.model.leaveGroup();
            this.$el.find('.menu-list').hide();
        },

        toggleMenu: function() {
            this.$el.find('.menu-list').toggle();
        },

        newGroupUpdate: function() {
            if (!this.newGroupUpdateView) {
                this.newGroupUpdateView = new Whisper.NewGroupUpdateView({
                    model: this.model
                });
            } else {
                this.newGroupUpdateView.delegateEvents();
            }
            this.newGroupUpdateView.render().$el.insertBefore(this.view.el);
        },

        destroyMessages: function(e) {
            if (confirm("Permanently delete this conversation?")) {
                this.model.destroyMessages();
                this.model.collection.remove(this.model);
                this.remove();
                this.model.trigger('destroy');
            }
            this.$el.find('.menu-list').hide();
        },

        sendMessage: function(e) {
            e.preventDefault();
            var input = this.$el.find('.send input.send-message');
            var message = input.val();
            var convo = this.model;

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    convo.sendMessage(message, attachments);
                });
                input.val("");
                this.fileInput.deleteFiles();
            }
        }
    });
})();
