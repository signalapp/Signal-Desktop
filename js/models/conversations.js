/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
  'use strict';
   window.Whisper = window.Whisper || {};

   // TODO: Factor out private and group subclasses of Conversation

   var COLORS = [
        "#EF5350", // red
        "#EC407A", // pink
        "#AB47BC", // purple
        "#7E57C2", // deep purple
        "#5C6BC0", // indigo
        "#2196F3", // blue
        "#03A9F4", // light blue
        "#00BCD4", // cyan
        "#009688", // teal
        "#4CAF50", // green
        "#7CB342", // light green
        "#FF9800", // orange
        "#FF5722", // deep orange
        "#FFB300", // amber
        "#607D8B", // blue grey
    ];

  Whisper.Conversation = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    defaults: function() {
      var timestamp = new Date().getTime();
      return {
        unreadCount : 0,
        timestamp   : timestamp,
      };
    },

    initialize: function() {
        this.contactCollection = new Backbone.Collection();
        this.messageCollection = new Whisper.MessageCollection([], {
            conversation: this
        });

        this.on('change:avatar', this.updateAvatarUrl);
        this.on('destroy', this.revokeAvatarUrl);
    },

    validate: function(attributes, options) {
        var required = ['id', 'type'];
        var missing = _.filter(required, function(attr) { return !attributes[attr]; });
        if (missing.length) { return "Conversation must have " + missing; }

        if (attributes.type !== 'private' && attributes.type !== 'group') {
            return "Invalid conversation type: " + attributes.type;
        }

        // hack
        if (this.isPrivate()) {
            try {
                this.id = libphonenumber.util.verifyNumber(this.id);
                var number = libphonenumber.util.splitCountryCode(this.id);

                this.set({
                    e164_number: this.id,
                    national_number: '' + number.national_number,
                    international_number: '' + number.country_code + number.national_number
                });
            } catch(ex) {
                return ex;
            }
        }
    },

    sendMessage: function(body, attachments) {
        var now = Date.now();
        var message = this.messageCollection.add({
            body           : body,
            conversationId : this.id,
            type           : 'outgoing',
            attachments    : attachments,
            sent_at        : now,
            received_at    : now
        });
        message.save();

        this.save({
            unreadCount : 0,
            active_at   : now,
            timestamp   : now,
            lastMessage : body
        }).then(function() {
            ConversationController.updateInbox();
        });

        var sendFunc;
        if (this.get('type') == 'private') {
            sendFunc = textsecure.messaging.sendMessageToNumber;
        }
        else {
            sendFunc = textsecure.messaging.sendMessageToGroup;
        }
        sendFunc(this.get('id'), body, attachments, now).then(function() {
            message.save({'sent': true});
        }.bind(this)).catch(function(errors) {
            if (errors instanceof Error) {
                errors = [errors];
            }
            var keyErrors = [];
            _.each(errors, function(e) {
                if (e.error.name === 'OutgoingIdentityKeyError') {
                    keyErrors.push(e.error);
                }
            });
            if (keyErrors.length) {
                message.save({ errors : keyErrors }).then(function() {
                    ConversationController.updateInbox();
                });
            } else {
                if (!(errors instanceof Array)) {
                    errors = [errors];
                }
                errors.map(function(e) {
                    if (e.error && e.error.stack) {
                        console.error(e.error.stack);
                    }
                });
                throw errors;
            }
        });
    },

    endSession: function() {
        if (this.isPrivate()) {
            var now = Date.now();
            var message = this.messageCollection.add({
                conversationId : this.id,
                type           : 'outgoing',
                sent_at        : now,
                received_at    : now,
                flags          : textsecure.protobuf.DataMessage.Flags.END_SESSION
            });
            message.save();
            textsecure.messaging.closeSession(this.id).then(function() {
                message.save({sent: true});
            });
        }

    },

    leaveGroup: function() {
        var now = Date.now();
        if (this.get('type') === 'group') {
            textsecure.messaging.leaveGroup(this.id);
            this.messageCollection.add({
                group_update: { left: 'You' },
                conversationId : this.id,
                type           : 'outgoing',
                sent_at        : now,
                received_at    : now
            }).save();
        }
    },

    markRead: function() {
        if (this.get('unreadCount') > 0) {
            this.save({unreadCount: 0});
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

    archive: function() {
        this.set({active_at: null});
    },

    destroyMessages: function() {
        var models = this.messageCollection.models;
        this.messageCollection.reset([]);
        _.each(models, function(message) { message.destroy(); });
        this.archive();
        return this.save().then(function() {
            ConversationController.updateInbox();
        });
    },

    getTitle: function() {
        if (this.isPrivate()) {
            return this.get('name') || this.id;
        } else {
            return this.get('name') || 'Unknown group';
        }
    },

    getNumber: function() {
        if (this.isPrivate()) {
            return this.id;
        } else {
            return '';
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

    getAvatar: function() {
        if (this.avatarUrl === undefined) {
            this.updateAvatarUrl(true);
        }
        if (this.avatarUrl) {
            return { url: this.avatarUrl };
        } else if (this.isPrivate()) {
            var title = this.get('name');
            if (!title) {
                return { content: '#', color: '#999999' };
            }
            var initials = title.trim()[0];
            return {
                color: COLORS[Math.abs(this.hashCode()) % 15],
                content: initials
            };
        } else {
            return { url: '/images/group_default.png', color: 'gray' };
        }
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

        return textsecure.storage.axolotl.removeIdentityKey(number).then(function() {
            return textsecure.storage.axolotl.putIdentityKey(number, identityKey).then(function() {
                var promises = [];
                this.messageCollection.each(function(message) {
                    if (message.hasKeyConflict(number)) {
                        promises.push(new Promise(function(resolve) {
                            resolve(message.resolveConflict(number));
                        }));
                    }
                });
                return promises;
            }.bind(this));
        }.bind(this));
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

    fetchGroups: function(number) {
        return this.fetch({
            index: {
                name: 'group',
                only: number
            }
        });
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
})();
