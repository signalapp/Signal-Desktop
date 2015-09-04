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

    Whisper.NewGroupUpdateView = Whisper.View.extend({
        tagName:   "div",
        className: 'new-group-update',
        templateName: 'new-group-update',
        initialize: function(options) {
            this.render();
            this.avatarInput = new Whisper.FileInputView({
                el: this.$('.group-avatar'),
                window: options.window
            });

            this.recipients_view = new Whisper.RecipientsInputView();
            this.listenTo(this.recipients_view.typeahead, 'sync', function() {
                this.model.contactCollection.models.forEach(function(model) {
                    if (this.recipients_view.typeahead.get(model)) {
                        this.recipients_view.typeahead.remove(model);
                    }
                }.bind(this));
            });
            this.recipients_view.$el.insertBefore(this.$('.container'));

            this.$('.avatar').addClass('default');

            this.member_list_view = new Whisper.ContactListView({
                collection: this.model.contactCollection,
                className: 'members'
            });
            this.member_list_view.render();
            this.$('.scrollable').append(this.member_list_view.el);
        },
        events: {
            'click .back': 'goBack',
            'click .send': 'send',
            'focusin input.search': 'showResults',
            'focusout input.search': 'hideResults',
        },
        hideResults: function() {
            this.$('.results').hide();
        },
        showResults: function() {
            this.$('.results').show();
        },
        goBack: function() {
            this.trigger('back');
        },
        render_attributes: function() {
            return {
                name: this.model.getTitle(),
                avatar: this.model.getAvatar()
            };
        },
        send: function() {
            return this.avatarInput.getThumbnail().then(function(avatarFile) {
                var attrs = {
                    name: this.$('.name').val(),
                    members: _.union(this.model.get('members'), this.recipients_view.recipients.pluck('id'))
                };
                if (avatarFile) {
                    attrs.avatar = avatarFile;
                }
                this.model.set(attrs);
                var group_update = this.model.changed;
                this.model.save();

                if (group_update.avatar) {
                    this.model.trigger('change:avatar');
                }

                var now = Date.now();
                var message = this.model.messageCollection.add({
                    conversationId : this.model.id,
                    type           : 'outgoing',
                    sent_at        : now,
                    received_at    : now,
                    group_update   : group_update
                });
                message.save();
                textsecure.messaging.updateGroup(
                    this.model.id,
                    this.model.get('name'),
                    this.model.get('avatar'),
                    this.model.get('members')
                ).catch(function(errors) {
                    message.save({errors: errors.map(function(e){return e.error;})});
                }).then(function() {
                    message.save({sent: true});
                });

                this.goBack();
            }.bind(this));
        }
    });
})();
