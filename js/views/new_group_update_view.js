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

    Whisper.NewGroupUpdateView = Backbone.View.extend({
        tagName:   "div",
        className: "new-group-update-form",
        initialize: function(options) {
            if (this.$el.html().length === 0) {
                this.template = $('#new-group-update-form').html();
                Mustache.parse(this.template);
                this.$el.html(
                    Mustache.render(this.template, this.model.attributes)
                );
            }
            this.avatarInput = new Whisper.FileInputView({
                el: this.$el.find('.group-avatar')
            });

            if (this.model.attributes.avatar) {
                new Whisper.AttachmentView({
                    model: this.model.attributes.avatar
                }).render().$el.addClass('preview').prependTo(this.avatarInput.el);
            }

        },
        events: {
            'click .send': 'send'
        },
        send: function() {
            return this.avatarInput.getFiles().then(function(avatarFiles) {
                this.model.save({
                    name: this.$el.find('.name').val(),
                    avatar: avatarFiles[0],
                    members: _.union(this.model.get('members'), this.$el.find('.members').val().split(','))
                });
                textsecure.messaging.updateGroup(
                    this.model.id,
                    this.model.get('name'),
                    this.model.get('avatar'),
                    this.model.get('members')
                );
                this.remove();
            }.bind(this));
        }
    });
})();
