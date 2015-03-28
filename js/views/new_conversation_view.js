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

    Whisper.NewConversationView = Whisper.View.extend({
        className: 'new-conversation',
        template: $('#new-conversation').html(),
        initialize: function() {
            this.render();
            this.$group_update = this.$('.new-group-update-form');
            this.$create = this.$('.create');
            this.$input = this.$('input.search');

            // Group avatar file input
            this.avatarInput = new Whisper.FileInputView({
                el: this.$('.group-avatar')
            });

            this.recipients_view = new Whisper.RecipientsInputView();
            this.$('.scrollable').append(this.recipients_view.el);
            this.listenTo(this.getRecipients(), 'add', this.updateControls);
            this.listenTo(this.getRecipients(), 'remove', this.updateControls);
        },

        events: {
            'click .create': 'create',
            'click .back': 'goBack',
            'keyup': 'keyup'
        },

        keyup: function(e) {
            if (e.keyCode === 27) {
                this.goBack();
            }
        },

        goBack: function() {
            this.trigger('back');
        },

        getRecipients: function() {
            return this.recipients_view.recipients;
        },

        updateControls: function() {
            if (this.getRecipients().length > 0) {
                this.$create.show();
            } else {
                this.$create.hide();
            }
            if (this.getRecipients().length > 1) {
                this.$group_update.slideDown();
            } else {
                this.$group_update.slideUp();
            }
            this.$input.focus();
        },

        create: function() {
            var errors = this.recipients_view.$('.error');
            if (errors.length) {

                // TODO: css animation or error notification
                errors.removeClass('error');
                setTimeout(function(){ errors.addClass('error'); }, 300);

                return;
            }
            if (this.getRecipients().length > 1) {
                this.createGroup();
            } else {
                this.createConversation();
            }
        },

        createConversation: function() {
            var conversation = new Whisper.Conversation({
                active_at: null,
                id: this.getRecipients().at(0).id,
                type: 'private'
            });
            conversation.fetch().then(function() {
                this.trigger('open', { modelId: conversation.id });
            }.bind(this)).fail(function() {
                var saved = conversation.save(); // false or indexedDBRequest
                if (saved) {
                    saved.then(function() {
                        this.trigger('open', { modelId: conversation.id });
                    }.bind(this));
                }
            }.bind(this));
        },

        createGroup: function() {
            var name = this.$('.new-group-update-form .name').val();
            if (!name.trim().length) {
                return;
            }

            return this.avatarInput.getFile().then(function(avatarFile) {
                var members = this.getRecipients().pluck('id');
                var groupId = textsecure.storage.groups.createNewGroup(members).id;
                var attributes = {
                    id: groupId,
                    groupId: groupId,
                    type: 'group',
                    name: name,
                    avatar: avatarFile,
                    members: members
                };
                var group = new Whisper.Conversation(attributes);
                group.save().then(function() {
                    this.trigger('open', {modelId: groupId});
                }.bind(this));
                var now = Date.now();
                var message = group.messageCollection.add({
                    conversationId : group.id,
                    type           : 'outgoing',
                    sent_at        : now,
                    received_at    : now,
                    group_update   : {
                        name: group.get('name'),
                        avatar: group.get('avatar'),
                        joined: group.get('members')
                    }
                });
                message.save();
                textsecure.messaging.updateGroup(
                    group.id,
                    group.get('name'),
                    group.get('avatar'),
                    group.get('members')
                ).catch(function(errors) {
                    message.save({errors: errors.map(function(e){return e.error;})});
                });
            }.bind(this));
        },

        reset: function() {
            this.$create.hide();
            this.$('.new-group-update-form .name').val('');
            this.$group_update.hide();
            this.recipients_view.reset();
        },
    });

})();
