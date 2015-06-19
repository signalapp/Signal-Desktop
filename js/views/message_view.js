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

    Whisper.MessageView = Whisper.View.extend({
        tagName:   "li",
        template: $('#message').html(),
        initialize: function() {
            this.listenTo(this.model, 'change:body change:errors', this.render);
            this.listenTo(this.model, 'change:delivered', this.renderDelivered);
            this.listenTo(this.model, 'change', this.renderPending);
            this.listenTo(this.model, 'change:flags change:group_update', this.renderControl);
            this.listenTo(this.model, 'destroy', this.remove);
        },
        events: {
            'click .timestamp': 'select'
        },
        select: function() {
            this.$el.trigger('select', {message: this.model});
        },
        className: function() {
            return ["entry", this.model.get('type')].join(' ');
        },
        renderPending: function() {
            if (this.model.isOutgoing()) {
                this.$el.toggleClass('pending', !!this.model.get('pending'));
            }
        },
        renderDelivered: function() {
            if (this.model.get('delivered')) { this.$el.addClass('delivered'); }
        },
        renderControl: function() {
            if (this.model.isEndSession() || this.model.isGroupUpdate()) {
                this.$el.addClass('control');
                this.$('.content').text(this.model.getDescription());
            } else {
                this.$el.removeClass('control');
            }
        },
        autoLink: function(text) {
            return text.replace(/(^|[\s\n]|<br\/?>)((?:https?|ftp):\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi, "$1<a href='$2' target='_blank'>$2</a>");
        },
        render: function() {
            var contact = this.model.getContact();
            this.$el.html(
                Mustache.render(this.template, {
                    message: this.model.get('body'),
                    timestamp: moment(this.model.get('sent_at')).fromNow(),
                    sender: (contact && contact.getTitle()) || '',
                    avatar: (contact && contact.getAvatar())
                }, this.render_partials())
            );

            twemoji.parse(this.el, { base: '/images/twemoji/', size: 16 });

            var content = this.$('.content');
            content.html(this.autoLink(content.html()));

            this.renderDelivered();
            this.renderPending();
            this.renderControl();

            this.$('.attachments').append(
                this.model.get('attachments').map(function(attachment) {
                    return new Whisper.AttachmentView({
                        model: attachment
                    }).render().el;
                })
            );

            var errors = this.model.get('errors');
            if (errors && errors.length) {
                this.$('.bubble').prepend(
                    errors.map(function(error) {
                        return new Whisper.MessageErrorView({
                            model: error,
                            message: this.model
                        }).render().el;
                    }.bind(this))
                );
            }
            return this;
        }
    });

})();
