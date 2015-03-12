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

    Whisper.ConversationView = Whisper.View.extend({
        className: function() {
            return [ 'conversation', this.model.get('type') ].join(' ');
        },
        template: $('#conversation').html(),
        render_attributes: function() {
            return { group: this.model.get('type') === 'group' };
        },
        initialize: function() {
            this.listenTo(this.model, 'destroy', this.stopListening);

            this.render();

            emoji.init_colons();

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
            'click .verify-identity': 'verifyIdentity',
            'click .hamburger': 'toggleMenu',
            'click' : 'onClick',
            'select .entry': 'messageDetail'
        },

        onClick: function(e) {
            this.closeMenu(e);
            this.markRead(e);
        },

        markRead: function(e) {
            this.model.markRead();
        },

        verifyIdentity: function() {
            if (this.model.isPrivate()) {
                var number = this.model.id;
                var view = new Whisper.KeyVerificationView({
                    model: {
                        their_key: textsecure.storage.devices.getIdentityKeyForNumber(number),
                        your_key: textsecure.storage.devices.getIdentityKeyForNumber(
                            textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0]
                        )
                    }
                });
                this.$el.hide();
                view.render().$el.insertAfter(this.el);
                this.listenTo(view, 'back', function() {
                    view.remove();
                    this.$el.show();
                });
            }
        },

        messageDetail: function(e, data) {
            var view = new Whisper.MessageDetailView({
                model: data.message,
                conversation: this.model
            });
            view.$el.insertAfter(this.$el);
            this.$el.hide();
            view.render();
            this.listenBack(view);
        },

        listenBack: function(view) {
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
            this.newGroupUpdateView = new Whisper.NewGroupUpdateView({
                model: this.model
            });
            this.newGroupUpdateView.$el.insertAfter(this.el);
            this.$el.hide();
            this.listenBack(this.newGroupUpdateView);
        },

        destroyMessages: function(e) {
            if (confirm("Permanently delete this conversation?")) {
                this.model.destroyMessages();
            }
            this.$el.find('.menu-list').hide();
        },

        sendMessage: function(e) {
            e.preventDefault();
            var input = this.$el.find('.send input.send-message');
            var message = this.replace_colons(input.val());
            var convo = this.model;

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    convo.sendMessage(message, attachments);
                });
                input.val("");
                this.fileInput.deleteFiles();
            }
        },
        replace_colons: function(str) {
            return str.replace(emoji.rx_colons, function(m){
                var idx = m.substr(1, m.length-2);
                var val = emoji.map.colons[idx];
                if (val) {
                    return emoji.data[val][0][0];
                } else {
                    return m;
                }
            });
        }
    });
})();
