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

    var Message  = window.Whisper.Message = Backbone.Model.extend({
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
            var flag = textsecure.protobuf.DataMessage.Flags.END_SESSION;
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
                    promise.then(function(dataMessage) {
                        this.handleDataMessage(dataMessage);
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
        handleDataMessage: function(dataMessage) {
            // This function can be called from the background script on an
            // incoming message or from the frontend after the user accepts an
            // identity key change.
            var message = this;
            var source = message.get('source');
            var type = message.get('type');
            var timestamp = message.get('sent_at');
            var conversationId = message.get('conversationId');
            if (dataMessage.group) {
                conversationId = dataMessage.group.id;
            }
            var conversation = new Whisper.Conversation({id: conversationId});
            conversation.fetch().always(function() {
                var now = new Date().getTime();
                var attributes = { type: 'private' };
                if (dataMessage.group) {
                    var group_update = {};
                    attributes = {
                        type: 'group',
                        groupId: dataMessage.group.id,
                    };
                    if (dataMessage.group.type === textsecure.protobuf.GroupContext.Type.UPDATE) {
                        attributes = {
                            type       : 'group',
                            groupId    : dataMessage.group.id,
                            name       : dataMessage.group.name,
                            avatar     : dataMessage.group.avatar,
                            members    : dataMessage.group.members,
                        };
                        group_update = conversation.changedAttributes(_.pick(dataMessage.group, 'name', 'avatar'));
                        var difference = _.difference(dataMessage.group.members, conversation.get('members'));
                        if (difference.length > 0) {
                            group_update.joined = difference;
                        }
                    }
                    else if (dataMessage.group.type === textsecure.protobuf.GroupContext.Type.QUIT) {
                        group_update = { left: source };
                        attributes.members = _.without(conversation.get('members'), source);
                    }

                    if (_.keys(group_update).length > 0) {
                        message.set({group_update: group_update});
                    }
                }
                if (type === 'outgoing') {
                    // lazy hack - check for receipts that arrived early.
                    if (dataMessage.group && dataMessage.group.id) {  // group sync
                        var members = conversation.get('members') || [];
                        var receipts = window.receipts.where({ timestamp: timestamp });
                        for (var i in receipts) {
                            if (members.indexOf(receipts[i].get('source')) > -1) {
                                window.receipts.remove(receipts[i]);
                                message.set({
                                    delivered: (message.get('delivered') || 0) + 1
                                });
                            }
                        }
                    } else {
                        var receipt = window.receipts.findWhere({
                            timestamp: timestamp,
                            source: conversationId
                        });
                        if (receipt) {
                            window.receipts.remove(receipt);
                            message.set({
                                delivered: (message.get('delivered') || 0) + 1
                            });
                        }
                    }
                }
                attributes.active_at = now;
                if (type === 'incoming') {
                    attributes.unreadCount = conversation.get('unreadCount') + 1;
                }
                conversation.set(attributes);

                message.set({
                    body           : dataMessage.body,
                    conversationId : conversation.id,
                    attachments    : dataMessage.attachments,
                    decrypted_at   : now,
                    flags          : dataMessage.flags,
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
                        extension.trigger('updateInbox'); // inbox fetch
                        if (message.isIncoming()) {
                            notifyConversation(message);
                        } else {
                            updateConversation(conversation.id);
                        }
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

        fetchConversation: function(conversationId) {
            var options = {remove: false};
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
