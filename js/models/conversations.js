/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';
   window.Whisper = window.Whisper || {};

   // TODO: Factor out private and group subclasses of Conversation

   var COLORS = [
        'red',
        'pink',
        'purple',
        'deep_purple',
        'indigo',
        'blue',
        'light_blue',
        'cyan',
        'teal',
        'green',
        'light_green',
        'orange',
        'deep_orange',
        'amber',
        'blue_grey',
    ];

  Whisper.Conversation = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    defaults: function() {
      return { unreadCount : 0 };
    },

    initialize: function() {
        this.contactCollection = new Backbone.Collection();
        this.messageCollection = new Whisper.MessageCollection([], {
            conversation: this
        });

        this.on('change:avatar', this.updateAvatarUrl);
        this.on('destroy', this.revokeAvatarUrl);
        this.on('read', this.onReadMessage);
    },

    onReadMessage: function(message) {
        if (this.messageCollection.get(message.id)) {
            this.messageCollection.get(message.id).fetch();
        }

        return this.getUnread().then(function(unreadMessages) {
            this.save({unreadCount: unreadMessages.length});
            if (unreadMessages.length) {
                console.log(this.id, 'unread messages:', unreadMessages.pluck('sent_at'));
            }
        }.bind(this));
    },

    getUnread: function() {
        var conversationId = this.id;
        var unreadMessages = new Whisper.MessageCollection();
        return new Promise(function(resolve) {
            return unreadMessages.fetch({
                index: {
                    // 'unread' index
                    name  : 'unread',
                    lower : [conversationId],
                    upper : [conversationId, Number.MAX_VALUE],
                }
            }).always(function() {
                resolve(unreadMessages);
            });
        });

    },

    validate: function(attributes, options) {
        var required = ['id', 'type'];
        var missing = _.filter(required, function(attr) { return !attributes[attr]; });
        if (missing.length) { return "Conversation must have " + missing; }

        if (attributes.type !== 'private' && attributes.type !== 'group') {
            return "Invalid conversation type: " + attributes.type;
        }

        var error = this.validateNumber();
        if (error) { return error; }

        this.updateTokens();
    },

    validateNumber: function() {
        if (this.isPrivate()) {
            var regionCode = storage.get('regionCode');
            var number = libphonenumber.util.parseNumber(this.id, regionCode);
            if (number.isValidNumber) {
                this.set({ id: number.e164 });
            } else {
                return number.error || "Invalid phone number";
            }
        }
    },

    updateTokens: function() {
        var tokens = [];
        var name = this.get('name');
        if (typeof name === 'string') {
            tokens.push(name.toLowerCase());
            tokens = tokens.concat(name.trim().toLowerCase().split(/[\s\-_\(\)\+]+/));
        }
        if (this.isPrivate()) {
            var regionCode = storage.get('regionCode');
            var number = libphonenumber.util.parseNumber(this.id, regionCode);
            tokens.push(
                number.nationalNumber,
                number.countryCode + number.nationalNumber
            );
        }
        this.set({tokens: tokens});
    },

    queueJob: function(callback) {
        var previous = this.pending || Promise.resolve();
        var current = this.pending = previous.then(callback, callback);

        current.then(function() {
            if (this.pending === current) {
                delete this.pending;
            }
        }.bind(this));

        return current;
    },

    sendMessage: function(body, attachments) {
        this.queueJob(function() {
            var now = Date.now();
            var message = this.messageCollection.add({
                body           : body,
                conversationId : this.id,
                type           : 'outgoing',
                attachments    : attachments,
                sent_at        : now,
                received_at    : now
            });
            if (this.isPrivate()) {
                message.set({destination: this.id});
            }
            message.save();

            this.save({
                unreadCount : 0,
                active_at   : now,
                timestamp   : now,
                lastMessage : message.getNotificationText()
            });

            var sendFunc;
            if (this.get('type') == 'private') {
                sendFunc = textsecure.messaging.sendMessageToNumber;
            }
            else {
                sendFunc = textsecure.messaging.sendMessageToGroup;
            }
            message.send(sendFunc(this.get('id'), body, attachments, now));
        }.bind(this));
    },

    isSearchable: function() {
        return !this.get('left') || !!this.get('lastMessage');
    },

    endSession: function() {
        if (this.isPrivate()) {
            var now = Date.now();
            var message = this.messageCollection.create({
                conversationId : this.id,
                type           : 'outgoing',
                sent_at        : now,
                received_at    : now,
                destination    : this.id,
                flags          : textsecure.protobuf.DataMessage.Flags.END_SESSION
            });
            message.send(textsecure.messaging.closeSession(this.id, now));
        }

    },

    updateGroup: function(group_update) {
        if (this.isPrivate()) {
            throw new Error("Called update group on private conversation");
        }
        if (group_update === undefined) {
            group_update = this.pick(['name', 'avatar', 'members']);
        }
        var now = Date.now();
        var message = this.messageCollection.create({
            conversationId : this.id,
            type           : 'outgoing',
            sent_at        : now,
            received_at    : now,
            group_update   : group_update
        });
        message.send(textsecure.messaging.updateGroup(
            this.id,
            this.get('name'),
            this.get('avatar'),
            this.get('members')
        ));
    },

    leaveGroup: function() {
        var now = Date.now();
        if (this.get('type') === 'group') {
            this.save({left: true});
            var message = this.messageCollection.create({
                group_update: { left: 'You' },
                conversationId : this.id,
                type           : 'outgoing',
                sent_at        : now,
                received_at    : now
            });
            message.send(textsecure.messaging.leaveGroup(this.id));
        }
    },

    markRead: function() {
        if (this.get('unreadCount') > 0) {
            this.save({ unreadCount: 0 });
            var conversationId = this.id;
            Whisper.Notifications.remove(Whisper.Notifications.where({
                conversationId: conversationId
            }));

            this.getUnread().then(function(unreadMessages) {
                var read = unreadMessages.map(function(m) {
                    if (this.messageCollection.get(m.id)) {
                        m = this.messageCollection.get(m.id);
                    }
                    m.markRead();
                    return {
                        sender    : m.get('source'),
                        timestamp : m.get('sent_at')
                    };
                }.bind(this));
                if (read.length > 0) {
                    console.log('Sending', read.length, 'read receipts');
                    textsecure.messaging.syncReadMessages(read);
                }
            }.bind(this));
        }
    },

    fetchMessages: function() {
        if (!this.id) { return false; }
        return this.messageCollection.fetchConversation(this.id);
    },

    fetchContacts: function(options) {
        return new Promise(function(resolve) {
            if (this.isPrivate()) {
                this.contactCollection.reset([this]);
                resolve();
            } else {
                var promises = [];
                var members = this.get('members') || [];
                this.contactCollection.reset(
                    members.map(function(number) {
                        var c = ConversationController.create({
                            id   : number,
                            type : 'private'
                        });
                        promises.push(new Promise(function(resolve) {
                            c.fetch().always(resolve);
                        }));
                        return c;
                    }.bind(this))
                );
                resolve(Promise.all(promises));
            }
        }.bind(this));
    },

    destroyMessages: function() {
        this.messageCollection.fetch({
            index: {
                // 'conversation' index on [conversationId, received_at]
                name  : 'conversation',
                lower : [this.id],
                upper : [this.id, Number.MAX_VALUE],
            }
        }).then(function() {
            var models = this.messageCollection.models;
            this.messageCollection.reset([]);
            _.each(models, function(message) { message.destroy(); });
            this.save({lastMessage: null, timestamp: null}); // archive
        }.bind(this));
    },

    getName: function() {
        if (this.isPrivate()) {
            return this.get('name');
        } else {
            return this.get('name') || 'Unknown group';
        }
    },

    getTitle: function() {
        if (this.isPrivate()) {
            return this.get('name') || this.getNumber();
        } else {
            return this.get('name') || 'Unknown group';
        }
    },

    getNumber: function() {
        if (!this.isPrivate()) {
            return '';
        }
        var number = this.id;
        try {
            var parsedNumber = libphonenumber.parse(number);
            var regionCode = libphonenumber.getRegionCodeForNumber(parsedNumber);
            if (regionCode === storage.get('regionCode')) {
                return libphonenumber.format(parsedNumber, libphonenumber.PhoneNumberFormat.NATIONAL);
            } else {
                return libphonenumber.format(parsedNumber, libphonenumber.PhoneNumberFormat.INTERNATIONAL);
            }
        } catch (e) {
            return number;
        }
    },

    isPrivate: function() {
        return this.get('type') === 'private';
    },

    revokeAvatarUrl: function() {
        if (this.avatarUrl) {
            URL.revokeObjectURL(this.avatarUrl);
            this.avatarUrl = null;
        }
    },

    updateAvatarUrl: function(silent) {
        this.revokeAvatarUrl();
        var avatar = this.get('avatar');
        if (avatar) {
            this.avatarUrl = URL.createObjectURL(
                new Blob([avatar.data], {type: avatar.contentType})
            );
        } else {
            this.avatarUrl = null;
        }
        if (!silent) {
            this.trigger('change');
        }
    },
    getColor: function() {
        var title = this.get('name');
        var color = this.get('color');
        if (!color) {
            if (this.isPrivate()) {
                if (title) {
                    color = COLORS[Math.abs(this.hashCode()) % 15];
                } else {
                    color = 'grey';
                }
            } else {
                color = 'default';
            }
        }
        return color;
    },
    getAvatar: function() {
        if (this.avatarUrl === undefined) {
            this.updateAvatarUrl(true);
        }

        var title = this.get('name');
        var color = this.getColor();

        if (this.avatarUrl) {
            return { url: this.avatarUrl, color: color };
        } else if (this.isPrivate()) {
            return {
                color: color,
                content: title ? title.trim()[0] : '#'
            };
        } else {
            return { url: '/images/group_default.png', color: color };
        }
    },

    getNotificationIcon: function() {
        return new Promise(function(resolve) {
            var avatar = this.getAvatar();
            if (avatar.url) {
                resolve(avatar.url);
            } else {
                resolve(new Whisper.IdenticonSVGView(avatar).getDataUrl());
            }
        }.bind(this));
    },

    resolveConflicts: function(conflict) {
        var number = conflict.number;
        var identityKey = conflict.identityKey;
        if (this.isPrivate()) {
            number = this.id;
        } else if (!_.include(this.get('members'), number)) {
            throw 'Tried to resolve conflicts for a unknown group member';
        }

        if (!this.messageCollection.hasKeyConflicts()) {
            throw 'No conflicts to resolve';
        }

        return textsecure.storage.protocol.removeIdentityKey(number).then(function() {
            return textsecure.storage.protocol.saveIdentity(number, identityKey).then(function() {
                var promise = Promise.resolve();
                var conflicts = this.messageCollection.filter(function(message) {
                    return message.hasKeyConflict(number);
                });
                // group incoming & outgoing
                conflicts = _.groupBy(conflicts, function(m) { return m.get('type'); });
                // sort each group by date and concatenate outgoing after incoming
                conflicts = _.flatten([
                    _.sortBy(conflicts.incoming, function(m) { return m.get('received_at'); }),
                    _.sortBy(conflicts.outgoing, function(m) { return m.get('received_at'); }),
                ]).forEach(function(message) {
                    var resolveConflict = function() {
                        return message.resolveConflict(number);
                    };
                    promise = promise.then(resolveConflict, resolveConflict);
                });
                return promise;
            }.bind(this));
        }.bind(this));
    },
    notify: function(message) {
        if (!message.isIncoming()) {
            return;
        }
        if (window.isOpen() && window.isFocused()) {
            return;
        }
        window.drawAttention();
        var sender = ConversationController.create({
            id: message.get('source'), type: 'private'
        });
        var conversationId = this.id;
        sender.fetch().then(function() {
            sender.getNotificationIcon().then(function(iconUrl) {
                console.log('adding notification');
                Whisper.Notifications.add({
                    title          : sender.getTitle(),
                    message        : message.getNotificationText(),
                    iconUrl        : iconUrl,
                    imageUrl       : message.getImageUrl(),
                    conversationId : conversationId,
                    messageId      : message.id
                });
            });
        });
    },
    hashCode: function() {
        if (this.hash === undefined) {
            var string = this.getTitle() || '';
            if (string.length === 0) {
                return 0;
            }
            var hash = 0;
            for (var i = 0; i < string.length; i++) {
                hash = ((hash<<5)-hash) + string.charCodeAt(i);
                hash = hash & hash; // Convert to 32bit integer
            }

            this.hash = hash;
        }
        return this.hash;
    }
  });

  Whisper.ConversationCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Whisper.Conversation,

    comparator: function(m) {
      return -m.get('timestamp');
    },

    destroyAll: function () {
        return Promise.all(this.models.map(function(m) {
            return new Promise(function(resolve, reject) {
                m.destroy().then(resolve).fail(reject);
            });
        }));
    },

    search: function(query) {
        query = query.trim().toLowerCase();
        if (query.length > 0) {
            query = query.replace(/[-.\(\)]*/g,'').replace(/^\+(\d*)$/, '$1');
            var lastCharCode = query.charCodeAt(query.length - 1);
            var nextChar = String.fromCharCode(lastCharCode + 1);
            var upper = query.slice(0, -1) + nextChar;
            return new Promise(function(resolve) {
                this.fetch({
                    index: {
                        name: 'search', // 'search' index on tokens array
                        lower: query,
                        upper: upper,
                        excludeUpper: true
                    }
                }).always(resolve);
            }.bind(this));
        }
    },

    fetchAlphabetical: function() {
        return new Promise(function(resolve) {
            this.fetch({
                index: {
                    name: 'search', // 'search' index on tokens array
                },
                limit: 100
            }).always(resolve);
        }.bind(this));
    },

    fetchGroups: function(number) {
        return new Promise(function(resolve) {
            this.fetch({
                index: {
                    name: 'group',
                    only: number
                }
            }).always(resolve);
        }.bind(this));
    },

    fetchActive: function() {
        // Ensures all active conversations are included in this collection,
        // and updates their attributes, but removes nothing.
        return this.fetch({
            index: {
                name: 'inbox', // 'inbox' index on active_at
                order: 'desc'  // ORDER timestamp DESC
                // TODO pagination/infinite scroll
                // limit: 10, offset: page*10,
            },
            remove: false
        });
    }
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');
})();
