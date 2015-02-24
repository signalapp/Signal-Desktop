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

    var Message  = Backbone.Model.extend({
        database  : Whisper.Database,
        storeName : 'messages',
        defaults  : function() {
            return {
                timestamp: new Date().getTime(),
                attachments: []
            };
        },
        validate: function(attributes, options) {
            var required = ['conversationId', 'received_at', 'sent_at'];
            var missing = _.filter(required, function(attr) { return !attributes[attr]; });
            if (missing.length) {
                console.log("Message missing attributes: " + missing);
            }
        },
        isEndSession: function() {
            var flag = textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
            return !!(this.get('flags') & flag);
        },
        isGroupUpdate: function() {
            return !!(this.get('group_update'));
        },
        isIncoming: function() {
            return this.get('type') === 'incoming';
        },
        isOutgoing: function() {
            return this.get('type') === 'outgoing';
        },
        getKeyConflict: function() {
            return _.find(this.get('errors'), function(e) {
                return ( e.name === 'IncomingIdentityKeyError' ||
                         e.name === 'OutgoingIdentityKeyError');
            });
        }
    });

    Whisper.MessageCollection = Backbone.Collection.extend({
        model      : Message,
        database   : Whisper.Database,
        storeName  : 'messages',
        comparator : 'received_at',
        destroyAll : function () {
            return Promise.all(this.models.map(function(m) {
                return new Promise(function(resolve, reject) {
                    m.destroy().then(resolve).fail(reject);
                });
            }));
        },

        fetchSentAt: function(timestamp) {
            return this.fetch({
                index: {
                    // 'receipt' index on sent_at
                    name: 'receipt',
                    only: timestamp
                }
            });
        },

        fetchConversation: function(conversationId, options) {
            options = options || {};
            options.index = {
                // 'conversation' index on [conversationId, received_at]
                name  : 'conversation',
                lower : [conversationId],
                upper : [conversationId, Number.MAX_VALUE]
                // SELECT messages WHERE conversationId = this.id ORDER
                // received_at DESC
            };
            // TODO pagination/infinite scroll
            // limit: 10, offset: page*10,
            return this.fetch(options);
        }
    });
})();
