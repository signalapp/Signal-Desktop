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

    var ErrorView = Backbone.View.extend({
        className: 'error',
        initialize: function() {
            this.template = $('#generic-error').html();
            Mustache.parse(this.template);
        },
        render: function() {
            this.$el.html(Mustache.render(this.template, this.model));
            return this;
        }
    });

    var KeyConflictView = ErrorView.extend({
        className: 'key-conflict',
        initialize: function(options) {
            this.message = options.message;
            if (this.message.isIncoming()) {
                this.template = $('#incoming-key-conflict').html();
            } else if (this.message.isOutgoing()) {
                this.template = $('#outgoing-key-conflict').html();
            }
            Mustache.parse(this.template);
        },
        events: {
            'click': 'select'
        },
        select: function() {
            this.$el.trigger('select', {message: this.message});
        },
    });

    Whisper.MessageErrorView = Backbone.View.extend({
        className: 'error',
        initialize: function(options) {
            if (this.model.name === 'IncomingIdentityKeyError' ||
                this.model.name === 'OutgoingIdentityKeyError') {
                this.view = new KeyConflictView({
                    model   : this.model,
                    message : options.message
                });
            } else {
                this.view = new ErrorView({ model: this.model });
            }
            this.$el.append(this.view.el);
            this.view.render();
        },
        render: function() {
            this.view.render();
            return this;
        }
    });
})();
