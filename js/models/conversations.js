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

    function constantTimeEqualArrayBuffers(ab1, ab2) {
        if (!(ab1 instanceof ArrayBuffer && ab2 instanceof ArrayBuffer)) {
            return false;
        }
        if (ab1.byteLength !== ab2.byteLength) {
            return false;
        }
        var result = true;
        var ta1 = new Uint8Array(ab1);
        var ta2 = new Uint8Array(ab2);
        for (var i = 0; i < ab1.byteLength; ++i) {
            if (ta1[i] !== ta2[i]) { result = false; }
        }
        return result;
    }

  Whisper.Conversation = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    defaults: function() {
        return {
            unreadCount: 0,
            verified: textsecure.storage.protocol.VerifiedStatus.DEFAULT
        };
    },

    idForLogging: function() {
        if (this.isPrivate()) {
            return this.id;
        }

        return 'group(' + this.id + ')';
    },

    handleMessageError: function(message, errors) {
        this.trigger('messageError', message, errors);
    },

    initialize: function() {
        this.ourNumber = textsecure.storage.user.getNumber();
        this.verifiedEnum = textsecure.storage.protocol.VerifiedStatus;

        // This may be overridden by ConversationController.getOrCreate, and signify
        //   our first save to the database. Or first fetch from the database.
        this.initialPromise = Promise.resolve();

        this.contactCollection = new Backbone.Collection();
        var collator = new Intl.Collator();
        this.contactCollection.comparator = function(left, right) {
            left = left.getTitle().toLowerCase();
            right = right.getTitle().toLowerCase();
            return collator.compare(left, right);
        };
        this.messageCollection = new Whisper.MessageCollection([], {
            conversation: this
        });

        this.messageCollection.on('change:errors', this.handleMessageError, this);
        this.messageCollection.on('send-error', this.onMessageError, this);

        this.on('change:avatar', this.updateAvatarUrl);
        this.on('change:profileAvatar', this.updateAvatarUrl);
        this.on('change:profileKey', this.onChangeProfileKey);
        this.on('destroy', this.revokeAvatarUrl);
    },

    isMe: function() {
        return this.id === this.ourNumber;
    },

    onMessageError: function() {
        this.updateVerified();
    },
    safeGetVerified: function() {
        return textsecure.storage.protocol.getVerified(this.id).catch(function() {
            return textsecure.storage.protocol.VerifiedStatus.DEFAULT;
        });
    },
    updateVerified: function() {
        if (this.isPrivate()) {
            return Promise.all([
                this.safeGetVerified(),
                this.initialPromise,
            ]).then(function(results) {
                var trust = results[0];
                // we don't return here because we don't need to wait for this to finish
                this.save({verified: trust});
            }.bind(this));
        } else {
            return this.fetchContacts().then(function() {
                return Promise.all(this.contactCollection.map(function(contact) {
                    if (!contact.isMe()) {
                        return contact.updateVerified();
                    }
                }.bind(this)));
            }.bind(this)).then(this.onMemberVerifiedChange.bind(this));
        }
    },
    setVerifiedDefault: function(options) {
        var DEFAULT = this.verifiedEnum.DEFAULT;
        return this.queueJob(function() {
            return this._setVerified(DEFAULT, options);
        }.bind(this));
    },
    setVerified: function(options) {
        var VERIFIED = this.verifiedEnum.VERIFIED;
        return this.queueJob(function() {
            return this._setVerified(VERIFIED, options);
        }.bind(this));
    },
    setUnverified: function(options) {
        var UNVERIFIED = this.verifiedEnum.UNVERIFIED;
        return this.queueJob(function() {
            return this._setVerified(UNVERIFIED, options);
        }.bind(this));
    },
    _setVerified: function(verified, options) {
        options = options || {};
        _.defaults(options, {viaSyncMessage: false, viaContactSync: false, key: null});

        var DEFAULT = this.verifiedEnum.DEFAULT;
        var VERIFIED = this.verifiedEnum.VERIFIED;
        var UNVERIFIED = this.verifiedEnum.UNVERIFIED;

        if (!this.isPrivate()) {
            throw new Error('You cannot verify a group conversation. ' +
                            'You must verify individual contacts.');
        }

        var beginningVerified = this.get('verified');
        var promise;
        if (options.viaSyncMessage) {
            // handle the incoming key from the sync messages - need different
            // behavior if that key doesn't match the current key
            promise = textsecure.storage.protocol.processVerifiedMessage(
                this.id, verified, options.key
            );
        } else {
            promise = textsecure.storage.protocol.setVerified(
                this.id, verified
            );
        }

        var keychange;
        return promise.then(function(updatedKey) {
            keychange = updatedKey;
            return new Promise(function(resolve) {
                return this.save({verified: verified}).always(resolve);
            }.bind(this));
        }.bind(this)).then(function() {
            // Three situations result in a verification notice in the conversation:
            //   1) The message came from an explicit verification in another client (not
            //      a contact sync)
            //   2) The verification value received by the contact sync is different
            //      from what we have on record (and it's not a transition to UNVERIFIED)
            //   3) Our local verification status is VERIFIED and it hasn't changed,
            //      but the key did change (Key1/VERIFIED to Key2/VERIFIED - but we don't
            //      want to show DEFAULT->DEFAULT or UNVERIFIED->UNVERIFIED)
            if (!options.viaContactSync
                || (beginningVerified !== verified && verified !== UNVERIFIED)
                || (keychange && verified === VERIFIED)) {

                this.addVerifiedChange(this.id, verified === VERIFIED, {local: !options.viaSyncMessage});
            }
            if (!options.viaSyncMessage) {
                return this.sendVerifySyncMessage(this.id, verified);
            }
        }.bind(this));
    },
    sendVerifySyncMessage: function(number, state) {
        return textsecure.storage.protocol.loadIdentityKey(number).then(function(key) {
            return textsecure.messaging.syncVerification(number, state, key);
        });
    },
    getIdentityKeys: function() {
        var lookup = {};

        if (this.isPrivate()) {
            return textsecure.storage.protocol.loadIdentityKey(this.id).then(function(key) {
                lookup[this.id] = key;
                return lookup;
            }.bind(this)).catch(function(error) {
                console.log(
                    'getIdentityKeys error for conversation',
                    this.idForLogging(),
                    error && error.stack ? error.stack : error
                );
                return lookup;
            }.bind(this));
        } else {
            return Promise.all(this.contactCollection.map(function(contact) {
                return textsecure.storage.protocol.loadIdentityKey(contact.id).then(function(key) {
                    lookup[contact.id] = key;
                }).catch(function(error) {
                    console.log(
                        'getIdentityKeys error for group member',
                        contact.idForLogging(),
                        error && error.stack ? error.stack : error
                    );
                });
            })).then(function() {
                return lookup;
            });
        }
    },
    replay: function(error, message) {
        var replayable = new textsecure.ReplayableError(error);
        return replayable.replay(message.attributes).catch(function(error) {
            console.log(
                'replay error:',
                error && error.stack ? error.stack : error
            );
        });
    },
    decryptOldIncomingKeyErrors: function() {
        // We want to run just once per conversation
        if (this.get('decryptedOldIncomingKeyErrors')) {
            return Promise.resolve();
        }
        console.log('decryptOldIncomingKeyErrors start for', this.idForLogging());

        var messages = this.messageCollection.filter(function(message) {
            var errors = message.get('errors');
            if (!errors || !errors[0]) {
                return false;
            }
            var error = _.find(errors, function(error) {
                return error.name === 'IncomingIdentityKeyError';
            });

            return Boolean(error);
        });

        var markComplete = function() {
            console.log('decryptOldIncomingKeyErrors complete for', this.idForLogging());
            return new Promise(function(resolve) {
                this.save({decryptedOldIncomingKeyErrors: true}).always(resolve);
            }.bind(this));
        }.bind(this);

        if (!messages.length) {
            return markComplete();
        }

        console.log('decryptOldIncomingKeyErrors found', messages.length, 'messages to process');
        var safeDelete = function(message) {
            return new Promise(function(resolve) {
                message.destroy().always(resolve);
            });
        };

        return this.getIdentityKeys().then(function(lookup) {
            return Promise.all(_.map(messages, function(message) {
                var source = message.get('source');
                var error = _.find(message.get('errors'), function(error) {
                    return error.name === 'IncomingIdentityKeyError';
                });

                var key = lookup[source];
                if (!key) {
                    return;
                }

                if (constantTimeEqualArrayBuffers(key, error.identityKey)) {
                    return this.replay(error, message).then(function() {
                        return safeDelete(message);
                    });
                }
            }.bind(this)));
        }.bind(this)).catch(function(error) {
            console.log(
                'decryptOldIncomingKeyErrors error:',
                error && error.stack ? error.stack : error
            );
        }).then(markComplete);
    },
    isVerified: function() {
        if (this.isPrivate()) {
            return this.get('verified') === this.verifiedEnum.VERIFIED;
        } else {
            if (!this.contactCollection.length) {
                return false;
            }

            return this.contactCollection.every(function(contact) {
                if (contact.isMe()) {
                    return true;
                } else {
                    return contact.isVerified();
                }
            }.bind(this));
        }
    },
    isUnverified: function() {
        if (this.isPrivate()) {
            var verified = this.get('verified');
            return verified !== this.verifiedEnum.VERIFIED && verified !== this.verifiedEnum.DEFAULT;
        } else {
            if (!this.contactCollection.length) {
                return true;
            }

            return this.contactCollection.any(function(contact) {
                if (contact.isMe()) {
                    return false;
                } else {
                    return contact.isUnverified();
                }
            }.bind(this));
        }
    },
    getUnverified: function() {
        if (this.isPrivate()) {
            return this.isUnverified() ? new Backbone.Collection([this]) : new Backbone.Collection();
        } else {
            return new Backbone.Collection(this.contactCollection.filter(function(contact) {
                if (contact.isMe()) {
                    return false;
                } else {
                    return contact.isUnverified();
                }
            }.bind(this)));
        }
    },
    setApproved: function() {
        if (!this.isPrivate()) {
            throw new Error('You cannot set a group conversation as trusted. ' +
                            'You must set individual contacts as trusted.');
        }

        return textsecure.storage.protocol.setApproval(this.id, true);
    },
    safeIsUntrusted: function() {
        return textsecure.storage.protocol.isUntrusted(this.id).catch(function() {
            return false;
        });
    },
    isUntrusted: function() {
        if (this.isPrivate()) {
            return this.safeIsUntrusted();
        } else {
            if (!this.contactCollection.length) {
                return Promise.resolve(false);
            }

            return Promise.all(this.contactCollection.map(function(contact) {
                if (contact.isMe()) {
                    return false;
                } else {
                    return contact.safeIsUntrusted();
                }
            }.bind(this))).then(function(results) {
                return _.any(results, function(result) {
                    return result;
                });
            });
        }
    },
    getUntrusted: function() {
        // This is a bit ugly because isUntrusted() is async. Could do the work to cache
        //   it locally, but we really only need it for this call.
        if (this.isPrivate()) {
            return this.isUntrusted().then(function(untrusted) {
                if (untrusted) {
                    return new Backbone.Collection([this]);
                }

                return new Backbone.Collection();
            }.bind(this));
        } else {
            return Promise.all(this.contactCollection.map(function(contact) {
                if (contact.isMe()) {
                    return [false, contact];
                } else {
                    return Promise.all([contact.isUntrusted(), contact]);
                }
            }.bind(this))).then(function(results) {
                results = _.filter(results, function(result) {
                    var untrusted = result[0];
                    return untrusted;
                });
                return new Backbone.Collection(_.map(results, function(result) {
                    var contact = result[1];
                    return contact;
                }));
            }.bind(this));
        }
    },
    onMemberVerifiedChange: function() {
        // If the verified state of a member changes, our aggregate state changes.
        // We trigger both events to replicate the behavior of Backbone.Model.set()
        this.trigger('change:verified');
        this.trigger('change');
    },
    toggleVerified: function() {
        if (this.isVerified()) {
            return this.setVerifiedDefault();
        } else {
            return this.setVerified();
        }
    },

    addKeyChange: function(id) {
        console.log(
            'adding key change advisory for',
            this.idForLogging(),
            id,
            this.get('timestamp')
        );

        var timestamp = Date.now();
        var message = new Whisper.Message({
            conversationId : this.id,
            type           : 'keychange',
            sent_at        : this.get('timestamp'),
            received_at    : timestamp,
            key_changed    : id,
            unread         : 1
        });
        message.save().then(this.trigger.bind(this,'newmessage', message));
    },
    addVerifiedChange: function(id, verified, options) {
        options = options || {};
        _.defaults(options, {local: true});

        if (this.isMe()) {
            console.log('refusing to add verified change advisory for our own number');
            return;
        }

        var lastMessage = this.get('timestamp') || Date.now();

        console.log(
            'adding verified change advisory for',
            this.idForLogging(),
            id,
            lastMessage
        );

        var timestamp = Date.now();
        var message = new Whisper.Message({
            conversationId  : this.id,
            type            : 'verified-change',
            sent_at         : lastMessage,
            received_at     : timestamp,
            verifiedChanged : id,
            verified        : verified,
            local           : options.local,
            unread          : 1
        });
        message.save().then(this.trigger.bind(this,'newmessage', message));

        if (this.isPrivate()) {
            ConversationController.getAllGroupsInvolvingId(id).then(function(groups) {
                _.forEach(groups, function(group) {
                    group.addVerifiedChange(id, verified, options);
                });
            });
        }
    },

    onReadMessage: function(message) {
        if (this.messageCollection.get(message.id)) {
            this.messageCollection.get(message.id).fetch();
        }

        // We mark as read everything older than this message - to clean up old stuff
        //   still marked unread in the database. If the user generally doesn't read in
        //   the desktop app, so the desktop app only gets read syncs, we can very
        //   easily end up with messages never marked as read (our previous early read
        //   sync handling, read syncs never sent because app was offline)

        // We queue it because we often get a whole lot of read syncs at once, and
        //   their markRead calls could very easily overlap given the async pull from DB.

        // Lastly, we don't send read syncs for any message marked read due to a read
        //   sync. That's a notification explosion we don't need.
        return this.queueJob(function() {
            return this.markRead(message.get('received_at'), {sendReadReceipts: false});
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

        var taskWithTimeout = textsecure.createTaskWithTimeout(
            callback,
            'conversation ' + this.idForLogging()
        );

        var current = this.pending = previous.then(taskWithTimeout, taskWithTimeout);

        current.then(function() {
            if (this.pending === current) {
                delete this.pending;
            }
        }.bind(this));

        return current;
    },

    getRecipients: function() {
        if (this.isPrivate()) {
            return [ this.id ];
        } else {
            var me = textsecure.storage.user.getNumber();
            return _.without(this.get('members'), me);
        }
    },

    sendMessage: function(body, attachments) {
        this.queueJob(function() {
            var now = Date.now();

            console.log(
                'Sending message to conversation',
                this.idForLogging(),
                'with timestamp',
                now
            );

            var message = this.messageCollection.add({
                body           : body,
                conversationId : this.id,
                type           : 'outgoing',
                attachments    : attachments,
                sent_at        : now,
                received_at    : now,
                expireTimer    : this.get('expireTimer'),
                recipients     : this.getRecipients()
            });
            if (this.isPrivate()) {
                message.set({destination: this.id});
            }
            message.save();

            this.save({
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

            var profileKey;
            if (this.get('profileSharing')) {
               profileKey = storage.get('profileKey');
            }

            message.send(sendFunc(this.get('id'), body, attachments, now, this.get('expireTimer'), profileKey));
        }.bind(this));
    },

    updateLastMessage: function() {
        var collection = new Whisper.MessageCollection();
        return collection.fetchConversation(this.id, 1).then(function() {
            var lastMessage = collection.at(0);
            if (lastMessage) {
                if (lastMessage.get('type') === 'verified-change') {
                    return;
                }
                this.set({
                   lastMessage : lastMessage.getNotificationText(),
                   timestamp   : lastMessage.get('sent_at')
                });
            } else {
                this.set({ lastMessage: '', timestamp: null });
            }
            if (this.hasChanged('lastMessage') || this.hasChanged('timestamp')) {
                this.save();
            }
        }.bind(this));
    },

    updateExpirationTimer: function(expireTimer, source, received_at) {
        if (!expireTimer) { expireTimer = null; }
        source = source || textsecure.storage.user.getNumber();
        var timestamp = received_at || Date.now();
        this.save({ expireTimer: expireTimer });
        var message = this.messageCollection.add({
            conversationId        : this.id,
            type                  : received_at ? 'incoming' : 'outgoing',
            sent_at               : timestamp,
            received_at           : timestamp,
            flags                 : textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
            expirationTimerUpdate : {
              expireTimer    : expireTimer,
              source         : source
            }
        });
        if (this.isPrivate()) {
            message.set({destination: this.id});
        }
        if (message.isOutgoing()) {
            message.set({recipients: this.getRecipients() });
        }
        message.save();
        if (message.isOutgoing()) { // outgoing update, send it to the number/group
            var sendFunc;
            if (this.get('type') == 'private') {
                sendFunc = textsecure.messaging.sendExpirationTimerUpdateToNumber;
            }
            else {
                sendFunc = textsecure.messaging.sendExpirationTimerUpdateToGroup;
            }
            var profileKey;
            if (this.get('profileSharing')) {
               profileKey = storage.get('profileKey');
            }
            message.send(sendFunc(this.get('id'), this.get('expireTimer'), message.get('sent_at'), profileKey));
        }
        return message;
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
                recipients     : this.getRecipients(),
                flags          : textsecure.protobuf.DataMessage.Flags.END_SESSION
            });
            message.send(textsecure.messaging.resetSession(this.id, now));
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

    markRead: function(newestUnreadDate, options) {
        options = options || {};
        _.defaults(options, {sendReadReceipts: true});

        var conversationId = this.id;
        Whisper.Notifications.remove(Whisper.Notifications.where({
            conversationId: conversationId
        }));

        return this.getUnread().then(function(unreadMessages) {
            var promises = [];
            var oldUnread = unreadMessages.filter(function(message) {
                return message.get('received_at') <= newestUnreadDate;
            });

            var read = _.map(oldUnread, function(m) {
                if (this.messageCollection.get(m.id)) {
                    m = this.messageCollection.get(m.id);
                } else {
                    console.log('Marked a message as read in the database, but ' +
                                'it was not in messageCollection.');
                }
                promises.push(m.markRead());
                var errors = m.get('errors');
                return {
                    sender    : m.get('source'),
                    timestamp : m.get('sent_at'),
                    hasErrors : Boolean(errors && errors.length)
                };
            }.bind(this));

            // Some messages we're marking read are local notifications with no sender
            read = _.filter(read, function(m) {
                return Boolean(m.sender);
            });
            unreadMessages = unreadMessages.filter(function(m) {
                return Boolean(m.isIncoming());
            });

            var unreadCount = unreadMessages.length - read.length;
            var promise = new Promise(function(resolve, reject) {
                this.save({ unreadCount: unreadCount }).then(resolve, reject);
            }.bind(this));
            promises.push(promise);

            // If a message has errors, we don't want to send anything out about it.
            //   read syncs - let's wait for a client that really understands the message
            //      to mark it read. we'll mark our local error read locally, though.
            //   read receipts - here we can run into infinite loops, where each time the
            //      conversation is viewed, another error message shows up for the contact
            read = read.filter(function(item) {
                return !item.hasErrors;
            });

            if (read.length && options.sendReadReceipts) {
                console.log('Sending', read.length, 'read receipts');
                promises.push(textsecure.messaging.syncReadMessages(read));

                if (storage.get('read-receipt-setting')) {
                  _.each(_.groupBy(read, 'sender'), function(receipts, sender) {
                      var timestamps = _.map(receipts, 'timestamp');
                      promises.push(textsecure.messaging.sendReadReceipts(sender, timestamps));
                  });
                }
            }

            return Promise.all(promises);
        }.bind(this));
    },

    onChangeProfileKey: function() {
        if (this.isPrivate()) {
            this.getProfiles();
        }
    },

    getProfiles: function() {
        // request all conversation members' keys
        var ids = [];
        if (this.isPrivate()) {
            ids = [this.id];
        } else {
            ids = this.get('members');
        }
        return Promise.all(_.map(ids, this.getProfile));
    },

    getProfile: function(id) {
        return textsecure.messaging.getProfile(id).then(function(profile) {
            var identityKey = dcodeIO.ByteBuffer.wrap(profile.identityKey, 'base64').toArrayBuffer();

            return textsecure.storage.protocol.saveIdentity(
                id + '.1', identityKey, false
            ).then(function(changed) {
              if (changed) {
                  // save identity will close all sessions except for .1, so we
                  // must close that one manually.
                  var address = new libsignal.SignalProtocolAddress(id, 1);
                  console.log('closing session for', address.toString());
                  var sessionCipher = new libsignal.SessionCipher(textsecure.storage.protocol, address);
                  return sessionCipher.closeOpenSessionForDevice();
              }
            }).then(function() {
              var c = ConversationController.get(id);
              return Promise.all([
                c.setProfileName(profile.name),
                c.setProfileAvatar(profile.avatar)
              ]).then(function() {
                // success
                return new Promise(function(resolve, reject) {
                  c.save().then(resolve, reject);
                });
              }, function(e) {
                // fail
                if (e.name === 'ProfileDecryptError') {
                  // probably the profile key has changed.
                  console.log(
                    'decryptProfile error:',
                    id,
                    profile,
                    e && e.stack ? e.stack : e
                  );
                }
              });
            }.bind(this));
        }.bind(this)).catch(function(error) {
            console.log(
                'getProfile error:',
                error && error.stack ? error.stack : error
            );
        });
    },
    setProfileName: function(encryptedName) {
      var key = this.get('profileKey');
      if (!key) { return; }

      try {
        // decode
        var data = dcodeIO.ByteBuffer.wrap(encryptedName, 'base64').toArrayBuffer();

        // decrypt
        return textsecure.crypto.decryptProfileName(data, key).then(function(decrypted) {

          // encode
          var name = dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8');

          // set
          this.set({profileName: name});
        }.bind(this));
      }
      catch (e) {
        return Promise.reject(e);
      }
    },
    setProfileAvatar: function(avatarPath) {
      if (!avatarPath) { return; }
      return textsecure.messaging.getAvatar(avatarPath).then(function(avatar) {
        var key = this.get('profileKey');
        if (!key) { return; }
        // decrypt
        return textsecure.crypto.decryptProfile(avatar, key).then(function(decrypted) {
          // set
          this.set({
            profileAvatar: {
              data: decrypted,
              contentType: 'image/jpeg',
              size: decrypted.byteLength
            }
          });
        }.bind(this));
      }.bind(this));
    },
    setProfileKey: function(key) {
      return new Promise(function(resolve, reject) {
        if (!constantTimeEqualArrayBuffers(this.get('profileKey'), key)) {
          this.save({profileKey: key}).then(resolve, reject);
        } else {
          resolve();
        }
      }.bind(this));
    },

    fetchMessages: function() {
        if (!this.id) {
            return Promise.reject('This conversation has no id!');
        }
        return this.messageCollection.fetchConversation(this.id, null, this.get('unreadCount'));
    },

    hasMember: function(number) {
        return _.contains(this.get('members'), number);
    },
    fetchContacts: function(options) {
        if (this.isPrivate()) {
            this.contactCollection.reset([this]);
            return Promise.resolve();
        } else {
            var members = this.get('members') || [];
            var promises = members.map(function(number) {
                return ConversationController.getOrCreateAndWait(number, 'private');
            });

            return Promise.all(promises).then(function(contacts) {
                _.forEach(contacts, function(contact) {
                    this.listenTo(contact, 'change:verified', this.onMemberVerifiedChange);
                }.bind(this));

                this.contactCollection.reset(contacts);
            }.bind(this));
        }
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
            _.each(models, function(message) {
                message.destroy();
            });
            this.save({
                lastMessage: null,
                timestamp: null,
                active_at: null,
            });
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

    getProfileName: function() {
        if (this.isPrivate() && !this.get('name')) {
          return this.get('profileName');
        }
    },

    getDisplayName: function() {
        if (!this.isPrivate()) {
            return this.getTitle();
        }

        var name = this.get('name');
        if (name) {
            return name;
        }

        var profileName = this.get('profileName');
        if (profileName) {
            return this.getNumber() + ' ~' + profileName;
        }

        return this.getNumber();
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
        var avatar = this.get('avatar') || this.get('profileAvatar');
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
            return { url: 'images/group_default.png', color: color };
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

    notify: function(message) {
        if (!message.isIncoming()) {
            return Promise.resolve();
        }
        var conversationId = this.id;

        return ConversationController.getOrCreateAndWait(message.get('source'), 'private')
            .then(function(sender) {
                return sender.getNotificationIcon().then(function(iconUrl) {
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
    }
  });

  Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(' ');

  // Special collection for fetching all the groups a certain number appears in
  Whisper.GroupCollection = Backbone.Collection.extend({
    database: Whisper.Database,
    storeName: 'conversations',
    model: Whisper.Conversation,
    fetchGroups: function(number) {
        return new Promise(function(resolve) {
            this.fetch({
                index: {
                    name: 'group',
                    only: number
                }
            }).always(resolve);
        }.bind(this));
    }
  });
})();
