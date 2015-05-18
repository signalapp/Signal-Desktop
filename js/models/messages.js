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
        getDescription: function() {
            if (this.isGroupUpdate()) {
                var group_update = this.get('group_update');
                if (group_update.left) {
                    return group_update.left + ' left the group.';
                }

                var messages = ['Updated the group.'];
                if (group_update.name) {
                    messages.push("Title is now '" + group_update.name + "'.");
                }
                if (group_update.joined) {
                    messages.push(group_update.joined.join(', ') + ' joined the group.');
                }

                return messages.join(' ');
            }
            if (this.isEndSession()) {
                return 'Secure session ended.';
            }
            if (this.isIncoming() && this.hasKeyConflicts()) {
                return 'Received message with unknown identity key.';
            }

            return this.get('body');
        },
        getContact: function() {
            if (this.collection) {
                return this.collection.conversation.contactCollection.get(this.get('source'));
            }
        },
        isOutgoing: function() {
            return this.get('type') === 'outgoing';
        },
        hasKeyConflicts: function() {
            return _.any(this.get('errors'), function(e) {
                return (e.name === 'IncomingIdentityKeyError' ||
                        e.name === 'OutgoingIdentityKeyError');
            });
        },
        hasKeyConflict: function(number) {
            return _.any(this.get('errors'), function(e) {
                return (e.name === 'IncomingIdentityKeyError' ||
                        e.name === 'OutgoingIdentityKeyError') &&
                        e.number === number;
            });
        },
        getKeyConflict: function(number) {
            return _.find(this.get('errors'), function(e) {
                return (e.name === 'IncomingIdentityKeyError' ||
                        e.name === 'OutgoingIdentityKeyError') &&
                        e.number === number;
            });
        },
        resolveConflict: function(number) {
            var error = this.getKeyConflict(number);
            if (error) {
                var promise = new textsecure.ReplayableError(error).replay();
                if (this.isIncoming()) {
                    promise.then(function(pushMessageContent) {
                        this.handlePushMessageContent(pushMessageContent);
                        this.save('errors', []);
                    }.bind(this)).catch(function(e) {
                        //this.save('errors', [_.pick(e, ['name', 'message'])]);
                        var errors = this.get('errors').concat(
                            _.pick(e, ['name', 'message'])
                        );
                        this.save('errors', errors);
                    }.bind(this));
                } else {
                    promise.then(function() {
                        this.save('errors', _.reject(this.get('errors'), function(e) {
                            return e.name === 'OutgoingIdentityKeyError' &&
                                   e.number === number;
                        }));
                    }.bind(this));
                }
            }
        },
        handlePushMessageContent: function(pushMessageContent) {
            // This function can be called from the background script on an
            // incoming message or from the frontend after the user accepts an
            // identity key change.
            var message = this;
            var source = message.get('source');
            var timestamp = message.get('sent_at');
            return textsecure.processDecrypted(pushMessageContent, source).then(function(pushMessageContent) {
                var type = 'incoming';
                if (pushMessageContent.sync) {
                    type = 'outgoing';
                    timestamp = pushMessageContent.sync.timestamp.toNumber();
                }
                var now = new Date().getTime();

                var conversationId = source;
                if (pushMessageContent.sync) {
                    conversationId = pushMessageContent.sync.destination;
                } else if (pushMessageContent.group) {
                    conversationId = pushMessageContent.group.id;
                }
                var conversation = new Whisper.Conversation({id: conversationId});
                var attributes = {};
                conversation.fetch().always(function() {
                    if (pushMessageContent.group) {
                        var group_update = {};
                        attributes = {
                            type: 'group',
                            groupId: pushMessageContent.group.id,
                        };
                        if (pushMessageContent.group.type === textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE) {
                            attributes = {
                                type       : 'group',
                                groupId    : pushMessageContent.group.id,
                                name       : pushMessageContent.group.name,
                                avatar     : pushMessageContent.group.avatar,
                                members    : pushMessageContent.group.members,
                            };
                            group_update = conversation.changedAttributes(_.pick(pushMessageContent.group, 'name', 'avatar'));
                            var difference = _.difference(pushMessageContent.group.members, conversation.get('members'));
                            if (difference.length > 0) {
                                group_update.joined = difference;
                            }
                        }
                        else if (pushMessageContent.group.type === textsecure.protobuf.PushMessageContent.GroupContext.Type.QUIT) {
                            group_update = { left: source };
                            attributes.members = _.without(conversation.get('members'), source);
                        }

                        if (_.keys(group_update).length > 0) {
                            message.set({group_update: group_update});
                        }
                    }
                    attributes.active_at = now;
                    if (type === 'incoming') {
                        attributes.unreadCount = conversation.get('unreadCount') + 1;
                    }
                    conversation.set(attributes);

                    message.set({
                        body           : pushMessageContent.body,
                        conversationId : conversation.id,
                        attachments    : pushMessageContent.attachments,
                        decrypted_at   : now,
                        type           : type,
                        sent_at        : timestamp,
                        flags          : pushMessageContent.flags,
                        errors         : []
                    });

                    if (message.get('sent_at') > conversation.get('timestamp')) {
                        conversation.set({
                            timestamp: message.get('sent_at'),
                            lastMessage: message.get('body')
                        });
                    }

                    conversation.save().then(function() {
                        message.save().then(function() {
                            extension.trigger('message', message); // inbox fetch
                            if (message.isIncoming()) {
                                notifyConversation(message);
                            }
                        });
                    });
                });
            });
        }

    });

    Whisper.MessageCollection = Backbone.Collection.extend({
        model      : Message,
        database   : Whisper.Database,
        storeName  : 'messages',
        comparator : 'received_at',
        initialize : function(models, options) {
            if (options) {
                this.conversation = options.conversation;
            }
        },
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
        },

        hasKeyConflicts: function() {
            return this.any(function(m) { return m.hasKeyConflicts(); });
        }
    });
})();
