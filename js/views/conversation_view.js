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
            $('#header').after(this.view.el);

            this.model.fetchMessages({reset: true});
        },

        events: {
            'submit .send': 'sendMessage',
            'close': 'remove',
            'click .destroy': 'destroyMessages',
            'click .new-group-update': 'newGroupUpdate',
            'click .settings-btn': 'toggleSettings',
            'click .go-back': 'toggleSettings'
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
        },

        sendMessage: function(e) {
            e.preventDefault();
            var input = this.$el.find('.send input');
            var message = input.val();
            var convo = this.model;

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    convo.sendMessage(message, attachments);
                });
                input.val("");
            }
        },

        toggleSettings: function (e) {
            $('body').toggleClass('settings-open');
            console.log('toggling');
            debugger;
        },

        render: function() {
            this.delegateEvents();
            this.view.delegateEvents();
            this.view.scrollToBottom();
            return this;
        }
    });
})();
