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

    var ContentMessageView = Whisper.View.extend({
        tagName: 'div',
        template: $('#message').html(),
        initialize: function() {
            this.listenTo(this.model, 'change:body change:errors', this.render);
            this.listenTo(this.model, 'change:delivered', this.renderDelivered);
        },
        className: function() {
            if (this.model.get('delivered')) { return 'delivered'; }
        },
        renderDelivered: function() {
            if (this.model.get('delivered')) { this.$el.addClass('delivered'); }
        },
        autoLink: function(text) {
            return text.replace(/(^|[\s\n]|<br\/?>)((?:https?|ftp):\/\/[\-A-Z0-9+\u0026\u2019@#\/%?=()~_|!:,.;]*[\-A-Z0-9+\u0026@#\/%=~()_|])/gi, "$1<a href='$2' target='_blank'>$2</a>");
        },
        render: function() {
            var contact = this.model.getContact();
            this.$el.html(
                Mustache.render(this.template, {
                    message: this.model.get('body'),
                    timestamp: moment(this.model.get('received_at')).fromNow(),
                    sender: (contact && contact.getTitle()) || '',
                    avatar_url: (contact && contact.getAvatarUrl())
                }, this.render_partials())
            );

            twemoji.parse(this.el, { base: '/images/twemoji/', size: 16 });

            var content = this.$el.find('.content');
            content.html(this.autoLink(content.html()));

            this.renderDelivered();

            this.$el.find('.attachments').append(
                this.model.get('attachments').map(function(attachment) {
                    return new Whisper.AttachmentView({
                        model: attachment
                    }).render().el;
                })
            );

            var errors = this.model.get('errors');
            if (errors && errors.length) {
                this.$el.find('.bubble').prepend(
                    errors.map(function(error) {
                        return new Whisper.MessageErrorView({
                            model: error,
                            message: this.model
                        }).render().el;
                    }.bind(this))
                );
            }
        }
    });

    Whisper.MessageView = Backbone.View.extend({
        tagName:   "li",
        className: function() {
            return ["entry", this.model.get('type')].join(' ');
        },
        initialize: function() {
            if (this.model.isEndSession()) {
                this.view = new Whisper.EndSessionView();
            } else if (this.model.isGroupUpdate()) {
                this.view = new Whisper.GroupUpdateView({
                    model: this.model.get('group_update')
                });
            } else {
                this.view = new ContentMessageView({model: this.model});
            }
            this.$el.append(this.view.el);

            this.listenTo(this.model, 'destroy', this.remove); // auto update
        },
        events: {
            'click .timestamp': 'select'
        },
        select: function() {
            this.$el.trigger('select', {message: this.model});
        },
        render: function() {
            this.view.render();
            return this;
        }

    });

})();
