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

    var ContentMessageView = Backbone.View.extend({
        tagName: 'div',
        initialize: function() {
            this.template = $('#message').html();
            Mustache.parse(this.template);
        },
        className: function() {
            if (this.model.get('delivered')) { return 'delivered'; }
        },
        render: function() {
            this.$el.html(
                Mustache.render(this.template, {
                    message: this.model.get('body'),
                    timestamp: moment(this.model.get('received_at')).fromNow(),
                    sender: this.model.get('source')
                })
            );

            if (this.model.get('delivered')) { this.$el.addClass('delivered'); }

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

            this.listenTo(this.model, 'change',  this.render); // auto update
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
