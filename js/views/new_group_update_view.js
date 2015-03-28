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
        className: "new-group-update-form",
        template: $('#new-group-update-form').html(),
        initialize: function(options) {
            this.render();
            this.avatarInput = new Whisper.FileInputView({
                el: this.$('.group-avatar')
            });

            this.recipients_view = new Whisper.RecipientsInputView();
            this.$('.scrollable').append(this.recipients_view.el);
            this.$('.avatar').addClass('default');
        },
        events: {
            'click .back': 'goBack',
            'click .send': 'send'
        },
        goBack: function() {
            this.trigger('back');
        },
        render_attributes: function() {
            return {
                name: this.model.getTitle(),
                avatar_url: this.model.getAvatarUrl()
            };
        },
        send: function() {
            return this.avatarInput.getFiles().then(function(avatarFiles) {
                this.model.save({
                    name: this.$('.name').val(),
                    avatar: avatarFiles[0],
                    members: _.union(this.model.get('members'), this.recipients_view.recipients.pluck('id'))
                });
                textsecure.messaging.updateGroup(
                    this.model.id,
                    this.model.get('name'),
                    this.model.get('avatar'),
                    this.model.get('members')
                );
                this.goBack();
            }.bind(this));
        }
    });
})();
