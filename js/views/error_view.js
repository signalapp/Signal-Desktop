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
    var ErrorTextView = Backbone.View.extend({
        className: 'error',
        render: function() {
            this.$el.text(this.model.message);
            return this;
        }
    });

    var KeyConflictView = Backbone.View.extend({
        className: 'key-conflict',
        events: {
            'click .resolve' : 'resolve'
        },
        initialize: function(options) {
            this.template = $('#key-conflict').html();
            Mustache.parse(this.template);
            this.message = options.message;
        },
        resolve: function() {
            this.undelegateEvents(); // avoid double replays
            var replayable = new window.textsecure.ReplayableError(this.model);

            if (this.message.isOutgoing()) {
                replayable.onsuccess = function(){
                    this.message.save('errors', []);
                    this.onsuccess();
                }.bind(this);
            } else if (this.message.isIncoming()) {
                replayable.onsuccess = function(pushMessageContent) {
                    extension.trigger('message:decrypted', {
                        message_id : this.message.id,
                        data       : pushMessageContent
                    });
                    this.onsuccess();
                }.bind(this);
            }

            replayable.onfailure = function(new_errors) {
                if (!_.isArray(new_errors)) {
                    new_errors = [new_errors];
                }

                this.message.save('errors', new_errors);
                this.onfailure();
            }.bind(this);

            replayable.replay();
        },
        onfailure: function() {
            this.delegateEvents();
        },
        onsuccess: function() {
            this.remove();
        },
        render: function() {
            this.$el.html(
                Mustache.render(this.template, { message: this.model.message })
            );
            return this;
        }
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
                this.view = new ErrorTextView({ model: this.model });
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
