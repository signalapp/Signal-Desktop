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
            this.$group_update = this.$el.find('.new-group-update-form');
            this.$create = this.$el.find('.create');
            this.$input = this.$el.find('input.search');

            // Group avatar file input
            this.avatarInput = new Whisper.FileInputView({
                el: this.$el.find('.group-avatar')
            });

            this.recipients_view = new Whisper.RecipientsInputView();
            this.$el.find('.scrollable').append(this.recipients_view.el);
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
            var errors = this.recipients_view.$el.find('.error');
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
            var name = this.$el.find('.new-group-update-form .name').val();
            if (!name.trim().length) {
                return;
            }

            return this.avatarInput.getFiles().then(function(avatarFiles) {
                var attributes = {
                    type: 'group',
                    name: name,
                    avatar: avatarFiles[0],
                    members: this.getRecipients().pluck('id')
                };
                return textsecure.messaging.createGroup(
                    attributes.members, attributes.name, attributes.avatar
                ).then(function(groupId) {
                    var id = getString(groupId);
                    var group = new Whisper.Conversation(attributes);
                    group.save({ id: id, groupId: id }).then(function() {
                        this.trigger('open', {modelId: id});
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        },

        reset: function() {
            this.$create.hide();
            this.$group_update.hide();
            this.recipients_view.reset();
        },
    });

})();
