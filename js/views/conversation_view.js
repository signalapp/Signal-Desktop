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
    emoji.init_colons();

    Whisper.ConversationView = Whisper.View.extend({
        className: function() {
            return [ 'conversation', this.model.get('type') ].join(' ');
        },
        template: $('#conversation').html(),
        render_attributes: function() {
            return {
                group: this.model.get('type') === 'group',
                title: this.model.getTitle()
            };
        },
        initialize: function(options) {
            this.listenTo(this.model, 'destroy', this.stopListening);
            this.listenTo(this.model, 'change:name', this.updateTitle);

            this.render();

            this.appWindow = options.appWindow;
            new Whisper.WindowControlsView({
                appWindow: this.appWindow
            }).$el.insertAfter(this.$('.menu'));

            this.fileInput = new Whisper.FileInputView({
                el: this.$('.attachments'),
                window: this.appWindow.contentWindow
            });

            this.view = new Whisper.MessageListView({
                collection: this.model.messageCollection,
                window: this.appWindow.contentWindow
            });
            this.$('.discussion-container').append(this.view.el);
            this.view.render();

            this.$messageField = this.$('.send-message');

            var onResize = this.forceUpdateMessageFieldSize.bind(this);
            this.appWindow.contentWindow.addEventListener('resize', onResize);

            this.appWindow.onClosed.addListener(function () {
                this.appWindow.contentWindow.removeEventListener('resize', onResize);
                window.autosize.destroy(this.$messageField);
                this.remove();
            }.bind(this));

            setTimeout(function() {
                this.view.scrollToBottom();
            }.bind(this), 10);
        },

        events: {
            'submit .send': 'sendMessage',
            'input .send-message': 'updateMessageFieldSize',
            'keydown .send-message': 'updateMessageFieldSize',
            'click .destroy': 'destroyMessages',
            'click .end-session': 'endSession',
            'click .leave-group': 'leaveGroup',
            'click .new-group-update': 'newGroupUpdate',
            'click .verify-identity': 'verifyIdentity',
            'click .hamburger': 'toggleMenu',
            'click .openInbox' : 'openInbox',
            'click' : 'onClick',
            'select .entry': 'messageDetail'
        },

        openInbox: function() {
            openInbox();
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
                var their_number = this.model.id;
                var our_number = textsecure.storage.user.getNumber();
                textsecure.storage.axolotl.getIdentityKey(their_number).then(function(their_key) {
                    textsecure.storage.axolotl.getIdentityKey(our_number).then(function(our_key) {
                        var view = new Whisper.KeyVerificationView({
                            model: { their_key: their_key, your_key: our_key }
                        });
                        this.$el.hide();
                        view.render().$el.insertAfter(this.el);
                        this.listenTo(view, 'back', function() {
                            view.remove();
                            this.$el.show();
                        }.bind(this));
                    }.bind(this));
                }.bind(this));
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
            });
        },

        closeMenu: function(e) {
            if (e && !$(e.target).hasClass('hamburger')) {
                this.$('.menu-list').hide();
            }
        },

        endSession: function() {
            this.model.endSession();
            this.$('.menu-list').hide();
        },

        leaveGroup: function() {
            this.model.leaveGroup();
            this.$('.menu-list').hide();
        },

        toggleMenu: function() {
            this.$('.menu-list').toggle();
        },

        newGroupUpdate: function() {
            this.newGroupUpdateView = new Whisper.NewGroupUpdateView({
                model: this.model,
                window: this.appWindow.contentWindow
            });
            this.newGroupUpdateView.$el.insertAfter(this.el);
            this.$el.hide();
            this.listenBack(this.newGroupUpdateView);
        },

        destroyMessages: function(e) {
            this.confirm("Permanently delete this conversation?").then(function() {
                this.model.destroyMessages();
            }.bind(this));
            this.$('.menu-list').hide();
        },

        sendMessage: function(e) {
            e.preventDefault();
            var input = this.$messageField;
            var message = this.replace_colons(input.val());
            var convo = this.model;

            if (message.length > 0 || this.fileInput.hasFiles()) {
                this.fileInput.getFiles().then(function(attachments) {
                    convo.sendMessage(message, attachments);
                });
                input.val("");
                this.forceUpdateMessageFieldSize(e);
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
        },

        updateTitle: function() {
            this.$('.conversation-title').text(this.model.getTitle());
        },

        updateMessageFieldSize: function (event) {
            var keyCode = event.which || event.keyCode;

            if (keyCode === 13) {
                // enter pressed - submit the form now
                event.preventDefault();
                return this.$('.bottom-bar form').submit();
            }

            var $discussionContainer = this.$('.discussion-container'),
                $bottomBar = this.$('.bottom-bar');

            window.autosize(this.$messageField);
            $bottomBar.outerHeight(this.$messageField.outerHeight() + 1);
            var $bottomBarNewHeight = $bottomBar.outerHeight();
            $discussionContainer.outerHeight(this.$el.outerHeight() - $bottomBarNewHeight - this.$('#header').outerHeight());
        },

        forceUpdateMessageFieldSize: function (event) {
            window.autosize.update(this.$messageField);
            this.updateMessageFieldSize(event);
        }
    });
})();
