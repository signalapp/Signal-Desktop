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

    // list of conversations, showing user/group and last message sent
    Whisper.ConversationListItemView = Whisper.View.extend({
        tagName: 'div',
        className: 'contact',
        template: $('#contact').html(),
        events: {
            'click': 'select'
        },
        initialize: function() {
            this.listenTo(this.model, 'change', this.render); // auto update
            this.listenTo(this.model, 'destroy', this.remove); // auto update
            window.addEventListener('beforeunload', function () {
                this.stopListening();
            }.bind(this));
        },

        select: function(e) {
            this.$el.addClass('selected');
            this.$el.trigger('select', {modelId: this.model.id});
        },

        render: function() {
            this.$el.html(
                Mustache.render(this.template, {
                    contact_name: this.model.getTitle(),
                    last_message: this.model.get('lastMessage'),
                    last_message_timestamp: moment(this.model.get('timestamp')).format('MMM D'),
                    number: this.model.getNumber(),
                    avatar_url: this.model.getAvatarUrl()
                }, this.render_partials())
            );

            twemoji.parse(this.el, { base: '/images/twemoji/', size: 16 });

            var unread = this.model.get('unreadCount');
            if (unread > 0) {
                this.$el.addClass('unread');
            } else {
                this.$el.removeClass('unread');
            }

            return this;
        }

    });
})();
