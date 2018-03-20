/* eslint-disable */

(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    const { Attachment, Message: TypedMessage } = window.Signal.Types;
    const { context: migrationContext } = window.Signal.Migrations;

    var Message  = window.Whisper.Message = Backbone.Model.extend({
        database  : Whisper.Database,
        storeName : 'messages',
        initialize: function(attributes) {
            if (_.isObject(attributes)) {
                this.set(TypedMessage.initializeSchemaVersion(attributes));
            }

            this.on('change:attachments', this.updateImageUrl);
            this.on('destroy', this.onDestroy);
            this.on('change:expirationStartTimestamp', this.setToExpire);
            this.on('change:expireTimer', this.setToExpire);
            this.on('unload', this.revokeImageUrl);
            this.setToExpire();
        },
        idForLogging: function() {
            return this.get('source') + '.' + this.get('sourceDevice') + ' ' + this.get('sent_at');
        },
        defaults: function() {
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
        isExpirationTimerUpdate: function() {
            var flag = textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
            return !!(this.get('flags') & flag);
        },
        isGroupUpdate: function() {
            return !!(this.get('group_update'));
        },
        isIncoming: function() {
            return this.get('type') === 'incoming';
        },
        isUnread: function() {
            return !!this.get('unread');
        },
        // overriding this to allow for this.unset('unread'), save to db, then fetch()
        // to propagate. We don't want the unset key in the db so our unread index stays
        // small.
        // jscs:disable
        fetch: function(options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function(resp) {
                model.attributes = {}; // this is the only changed line
                if (!model.set(model.parse(resp, options), options)) return false;
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            var error = options.error;
                options.error = function(resp) {
                if (error) error(model, resp, options);
                model.trigger('error', model, resp, options);
            };
            return this.sync('read', this, options);
        },
        // jscs:enable
        getNameForNumber: function(number) {
            var conversation = ConversationController.get(number);
            if (!conversation) {
                return number;
            }
            return conversation.getDisplayName();
        },
        getDescription: function() {
            if (this.isGroupUpdate()) {
                var group_update = this.get('group_update');
                if (group_update.left === 'You') {
                    return i18n('youLeftTheGroup');
                } else if (group_update.left) {
                    return i18n('leftTheGroup', this.getNameForNumber(group_update.left));
                }

                var messages = [i18n('updatedTheGroup')];
                if (group_update.name) {
                    messages.push(i18n('titleIsNow', group_update.name));
                }
                if (group_update.joined && group_update.joined.length) {
                    var names = _.map(group_update.joined, this.getNameForNumber.bind(this));
                    if (names.length > 1) {
                        messages.push(i18n('multipleJoinedTheGroup', names.join(', ')));
                    } else {
                        messages.push(i18n('joinedTheGroup', names[0]));
                    }
                }

                return messages.join(' ');
            }
            if (this.isEndSession()) {
                return i18n('sessionEnded');
            }
            if (this.isIncoming() && this.hasErrors()) {
                return i18n('incomingError');
            }
            return this.get('body');
        },
        isKeyChange: function() {
            return this.get('type') === 'keychange';
        },
        getNotificationText: function() {
            var description = this.getDescription();
            if (description) {
                return description;
            }
            if (this.get('attachments').length > 0) {
                return i18n('mediaMessage');
            }
            if (this.isExpirationTimerUpdate()) {
                return i18n('timerSetTo',
                    Whisper.ExpirationTimerOptions.getAbbreviated(
                      this.get('expirationTimerUpdate').expireTimer
                    )
                );
            }
            if (this.isKeyChange()) {
                var conversation = this.getModelForKeyChange();
                return i18n('keychanged', conversation.getTitle());
            }

            return '';
        },
        /* eslint-enable */
        /* jshint ignore:start */
        async onDestroy() {
          this.revokeImageUrl();
          const attachments = this.get('attachments');
          const deleteData =
            Attachment.deleteData(migrationContext.deleteAttachmentData);
          await Promise.all(attachments.map(deleteData));
        },
        /* jshint ignore:end */
        /* eslint-disable */
        updateImageUrl: function() {
            this.revokeImageUrl();
            var attachment = this.get('attachments')[0];
            if (attachment) {
                var blob = new Blob([attachment.data], {
                    type: attachment.contentType
                });
                this.imageUrl = URL.createObjectURL(blob);
            } else {
                this.imageUrl = null;
            }
        },
        revokeImageUrl: function() {
            if (this.imageUrl) {
                URL.revokeObjectURL(this.imageUrl);
                this.imageUrl = null;
            }
        },
        getImageUrl: function() {
            if (this.imageUrl === undefined) {
                this.updateImageUrl();
            }
            return this.imageUrl;
        },
        getConversation: function() {
            // This needs to be an unsafe call, because this method is called during
            //   initial module setup. We may be in the middle of the initial fetch to
            //   the database.
            return ConversationController.getUnsafe(this.get('conversationId'));
        },
        getExpirationTimerUpdateSource: function() {
            if (this.isExpirationTimerUpdate()) {
              var conversationId = this.get('expirationTimerUpdate').source;
              return ConversationController.getOrCreate(conversationId, 'private');
            }
        },
        getContact: function() {
            var conversationId = this.get('source');
            if (!this.isIncoming()) {
                conversationId = textsecure.storage.user.getNumber();
            }
            return ConversationController.getOrCreate(conversationId, 'private');
        },
        getModelForKeyChange: function() {
            var id = this.get('key_changed');
            if (!this.modelForKeyChange) {
              var c = ConversationController.getOrCreate(id, 'private');
              this.modelForKeyChange = c;
            }
            return this.modelForKeyChange;
        },
        getModelForVerifiedChange: function() {
            var id = this.get('verifiedChanged');
            if (!this.modelForVerifiedChange) {
              var c = ConversationController.getOrCreate(id, 'private');
              this.modelForVerifiedChange = c;
            }
            return this.modelForVerifiedChange;
        },
        isOutgoing: function() {
            return this.get('type') === 'outgoing';
        },
        hasErrors: function() {
            return _.size(this.get('errors')) > 0;
        },

        getStatus: function(number) {
            var read_by = this.get('read_by') || [];
            if (read_by.indexOf(number) >= 0) {
              return 'read';
            }
            var delivered_to = this.get('delivered_to') || [];
            if (delivered_to.indexOf(number) >= 0) {
              return 'delivered';
            }
            var sent_to = this.get('sent_to') || [];
            if (sent_to.indexOf(number) >= 0) {
              return 'sent';
            }
        },

        send: function(promise) {
            this.trigger('pending');
            return promise.then(function(result) {
                var now = Date.now();
                this.trigger('done');
                if (result.dataMessage) {
                    this.set({dataMessage: result.dataMessage});
                }
                var sent_to = this.get('sent_to') || [];
                this.save({
                  sent_to: _.union(sent_to, result.successfulNumbers),
                  sent: true,
                  expirationStartTimestamp: now
                });
                this.sendSyncMessage();
            }.bind(this)).catch(function(result) {
                var now = Date.now();
                this.trigger('done');
                if (result.dataMessage) {
                    this.set({dataMessage: result.dataMessage});
                }

                var promises = [];

                if (result instanceof Error) {
                    this.saveErrors(result);
                    if (result.name === 'SignedPreKeyRotationError') {
                        promises.push(getAccountManager().rotateSignedPreKey());
                    }
                    else if (result.name === 'OutgoingIdentityKeyError') {
                        var c = ConversationController.get(result.number);
                        promises.push(c.getProfiles());
                    }
                } else {
                    this.saveErrors(result.errors);
                    if (result.successfulNumbers.length > 0) {
                        var sent_to = this.get('sent_to') || [];
                        this.set({
                          sent_to: _.union(sent_to, result.successfulNumbers),
                          sent: true,
                          expirationStartTimestamp: now
                        });
                        promises.push(this.sendSyncMessage());
                    }
                    promises = promises.concat(_.map(result.errors, function(error) {
                        if (error.name === 'OutgoingIdentityKeyError') {
                            var c = ConversationController.get(error.number);
                            promises.push(c.getProfiles());
                        }
                    }));
                }

                return Promise.all(promises).then(function() {
                    this.trigger('send-error', this.get('errors'));
                }.bind(this));
            }.bind(this));
        },

        someRecipientsFailed: function() {
            var c = this.getConversation();
            if (!c || c.isPrivate()) {
                return false;
            }

            var recipients = c.contactCollection.length - 1;
            var errors = this.get('errors');
            if (!errors) {
                return false;
            }

            if (errors.length > 0 && recipients > 0 && errors.length < recipients) {
                return true;
            }

            return false;
        },

        sendSyncMessage: function() {
            this.syncPromise = this.syncPromise || Promise.resolve();
            this.syncPromise = this.syncPromise.then(function() {
                var dataMessage = this.get('dataMessage');
                if (this.get('synced') || !dataMessage) {
                    return;
                }
                return textsecure.messaging.sendSyncMessage(
                    dataMessage, this.get('sent_at'), this.get('destination'), this.get('expirationStartTimestamp')
                ).then(function() {
                    this.save({synced: true, dataMessage: null});
                }.bind(this));
            }.bind(this));
        },

        saveErrors: function(errors) {
            if (!(errors instanceof Array)) {
                errors = [errors];
            }
            errors.forEach(function(e) {
                console.log(
                    'Message.saveErrors:',
                    e && e.reason ? e.reason : null,
                    e && e.stack ? e.stack : e
                );
            });
            errors = errors.map(function(e) {
                if (e.constructor === Error ||
                    e.constructor === TypeError ||
                    e.constructor === ReferenceError) {
                    return _.pick(e, 'name', 'message', 'code', 'number', 'reason');
                }
                return e;
            });
            errors = errors.concat(this.get('errors') || []);

            return this.save({errors : errors});
        },

        hasNetworkError: function(number) {
            var error = _.find(this.get('errors'), function(e) {
                return (e.name === 'MessageError' ||
                        e.name === 'OutgoingMessageError' ||
                        e.name === 'SendMessageNetworkError' ||
                        e.name === 'SignedPreKeyRotationError');
            });
            return !!error;
        },
        removeOutgoingErrors: function(number) {
            var errors = _.partition(this.get('errors'), function(e) {
                return e.number === number &&
                    (e.name === 'MessageError' ||
                     e.name === 'OutgoingMessageError' ||
                     e.name === 'SendMessageNetworkError' ||
                     e.name === 'SignedPreKeyRotationError' ||
                     e.name === 'OutgoingIdentityKeyError');
            });
            this.set({errors: errors[1]});
            return errors[0][0];
        },
        isReplayableError: function(e) {
            return (e.name === 'MessageError' ||
                    e.name === 'OutgoingMessageError' ||
                    e.name === 'SendMessageNetworkError' ||
                    e.name === 'SignedPreKeyRotationError' ||
                    e.name === 'OutgoingIdentityKeyError');
        },
        resend: function(number) {
            var error = this.removeOutgoingErrors(number);
            if (error) {
                var promise = new textsecure.ReplayableError(error).replay();
                this.send(promise);
            }
        },
        handleDataMessage: function(dataMessage, confirm) {
            // This function is called from the background script in a few scenarios:
            //   1. on an incoming message
            //   2. on a sent message sync'd from another device
            //   3. in rare cases, an incoming message can be retried, though it will
            //      still go through one of the previous two codepaths
            var message = this;
            var source = message.get('source');
            var type = message.get('type');
            var timestamp = message.get('sent_at');
            var conversationId = message.get('conversationId');
            if (dataMessage.group) {
                conversationId = dataMessage.group.id;
            }

            var conversation = ConversationController.get(conversationId);
            return conversation.queueJob(function() {
                return new Promise(function(resolve) {
                    var now = new Date().getTime();
                    var attributes = { type: 'private' };
                    if (dataMessage.group) {
                        var group_update = null;
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
                                members    : _.union(dataMessage.group.members, conversation.get('members')),
                            };
                            group_update = conversation.changedAttributes(_.pick(dataMessage.group, 'name', 'avatar')) || {};
                            var difference = _.difference(attributes.members, conversation.get('members'));
                            if (difference.length > 0) {
                                group_update.joined = difference;
                            }
                            if (conversation.get('left')) {
                              console.log('re-added to a left group');
                              attributes.left = false;
                            }
                        }
                        else if (dataMessage.group.type === textsecure.protobuf.GroupContext.Type.QUIT) {
                            if (source == textsecure.storage.user.getNumber()) {
                                attributes.left = true;
                                group_update = { left: "You" };
                            } else {
                                group_update = { left: source };
                            }
                            attributes.members = _.without(conversation.get('members'), source);
                        }

                        if (group_update !== null) {
                            message.set({group_update: group_update});
                        }
                    }
                    message.set({
                        schemaVersion  : dataMessage.schemaVersion,
                        body           : dataMessage.body,
                        conversationId : conversation.id,
                        attachments    : dataMessage.attachments,
                        decrypted_at   : now,
                        flags          : dataMessage.flags,
                        errors         : []
                    });
                    if (type === 'outgoing') {
                        var receipts = Whisper.DeliveryReceipts.forMessage(conversation, message);
                        receipts.forEach(function(receipt) {
                            message.set({
                                delivered: (message.get('delivered') || 0) + 1
                            });
                        });
                    }
                    attributes.active_at = now;
                    conversation.set(attributes);

                    if (message.isExpirationTimerUpdate()) {
                        message.set({
                            expirationTimerUpdate: {
                                source      : source,
                                expireTimer : dataMessage.expireTimer
                            }
                        });
                        conversation.set({expireTimer: dataMessage.expireTimer});
                    } else if (dataMessage.expireTimer) {
                        message.set({expireTimer: dataMessage.expireTimer});
                    }

                    // NOTE: Remove once the above uses
                    // `Conversation::updateExpirationTimer`:
                    const { expireTimer } = dataMessage;
                    const shouldLogExpireTimerChange =
                        message.isExpirationTimerUpdate() || expireTimer;
                    if (shouldLogExpireTimerChange) {
                        console.log(
                            'Updating expireTimer for conversation',
                            conversation.idForLogging(),
                            'to',
                            expireTimer,
                            'via `handleDataMessage`'
                        );
                    }

                    if (!message.isEndSession() && !message.isGroupUpdate()) {
                        if (dataMessage.expireTimer) {
                            if (dataMessage.expireTimer !== conversation.get('expireTimer')) {
                              conversation.updateExpirationTimer(
                                  dataMessage.expireTimer, source,
                                  message.get('received_at'));
                            }
                        } else if (conversation.get('expireTimer')) {
                            conversation.updateExpirationTimer(null, source,
                                message.get('received_at'));
                        }
                    }
                    if (type === 'incoming') {
                        var readSync = Whisper.ReadSyncs.forMessage(message);
                        if (readSync) {
                            if (message.get('expireTimer') && !message.get('expirationStartTimestamp')) {
                                message.set('expirationStartTimestamp', readSync.get('read_at'));
                            }
                        }
                        if (readSync || message.isExpirationTimerUpdate()) {
                            message.unset('unread');
                            // This is primarily to allow the conversation to mark all older messages as
                            //   read, as is done when we receive a read sync for a message we already
                            //   know about.
                            Whisper.ReadSyncs.notifyConversation(message);
                        } else {
                            conversation.set('unreadCount', conversation.get('unreadCount') + 1);
                        }
                    }

                    if (type === 'outgoing') {
                        var reads = Whisper.ReadReceipts.forMessage(conversation, message);
                        if (reads.length) {
                            var read_by = reads.map(function(receipt) {
                                return receipt.get('reader');
                            });
                            message.set({
                                read_by: _.union(message.get('read_by'), read_by)
                            });
                        }

                        message.set({recipients: conversation.getRecipients()});
                    }

                    var conversation_timestamp = conversation.get('timestamp');
                    if (!conversation_timestamp || message.get('sent_at') > conversation_timestamp) {
                        conversation.set({
                            lastMessage : message.getNotificationText(),
                            timestamp: message.get('sent_at')
                        });
                    }

                    if (dataMessage.profileKey) {
                      var profileKey = dataMessage.profileKey.toArrayBuffer();
                      if (source == textsecure.storage.user.getNumber()) {
                        conversation.set({profileSharing: true});
                      } else if (conversation.isPrivate()) {
                        conversation.set({profileKey: profileKey});
                      } else {
                        ConversationController.getOrCreateAndWait(source, 'private').then(function(sender) {
                          sender.setProfileKey(profileKey);
                        });
                      }
                    }

                    var handleError = function(error) {
                        error = error && error.stack ? error.stack : error;
                        console.log('handleDataMessage', message.idForLogging(), 'error:', error);
                        return resolve();
                    };

                    message.save().then(function() {
                        conversation.save().then(function() {
                            try {
                                conversation.trigger('newmessage', message);
                            }
                            catch (e) {
                                return handleError(e);
                            }
                            // We fetch() here because, between the message.save() above and the previous
                            //   line's trigger() call, we might have marked all messages unread in the
                            //   database. This message might already be read!
                            var previousUnread = message.get('unread');
                            message.fetch().then(function() {
                                try {
                                    if (previousUnread !== message.get('unread')) {
                                        console.log('Caught race condition on new message read state! ' +
                                                    'Manually starting timers.');
                                        // We call markRead() even though the message is already marked read
                                        //   because we need to start expiration timers, etc.
                                        message.markRead();
                                    }

                                    if (message.get('unread')) {
                                        conversation.notify(message).then(function() {
                                            confirm();
                                            return resolve();
                                        }, handleError);
                                    } else {
                                        confirm();
                                        return resolve();
                                    }
                                }
                                catch (e) {
                                    handleError(e);
                                }
                            }, function(error) {
                                try {
                                    console.log('handleDataMessage: Message', message.idForLogging(), 'was deleted');

                                    confirm();
                                    return resolve();
                                }
                                catch (e) {
                                    handleError(e);
                                }
                            });
                        }, handleError);
                    }, handleError);
                });
            });
        },
        markRead: function(read_at) {
            this.unset('unread');
            if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
                this.set('expirationStartTimestamp', read_at || Date.now());
            }
            Whisper.Notifications.remove(Whisper.Notifications.where({
                messageId: this.id
            }));
            return new Promise(function(resolve, reject) {
                this.save().then(resolve, reject);
            }.bind(this));
        },
        isExpiring: function() {
            return this.get('expireTimer') && this.get('expirationStartTimestamp');
        },
        isExpired: function() {
            return this.msTilExpire() <= 0;
        },
        msTilExpire: function() {
              if (!this.isExpiring()) {
                return Infinity;
              }
              var now = Date.now();
              var start = this.get('expirationStartTimestamp');
              var delta = this.get('expireTimer') * 1000;
              var ms_from_now = start + delta - now;
              if (ms_from_now < 0) {
                  ms_from_now = 0;
              }
              return ms_from_now;
        },
        setToExpire: function() {
            if (this.isExpiring() && !this.get('expires_at')) {
                var start = this.get('expirationStartTimestamp');
                var delta = this.get('expireTimer') * 1000;
                var expires_at = start + delta;

                // This method can be called due to the expiration-related .set() calls in
                //   handleDataMessage(), but the .save() here would conflict with the
                //   same call at the end of handleDataMessage(). So we only call .save()
                //   here if we've previously saved this model.
                if (!this.isNew()) {
                    this.save('expires_at', expires_at);
                }

                Whisper.ExpiringMessagesListener.update();
                console.log('message', this.get('sent_at'), 'expires at', expires_at);
            }
        }

    });

    Whisper.MessageCollection = Backbone.Collection.extend({
        model      : Message,
        database   : Whisper.Database,
        storeName  : 'messages',
        comparator : function(left, right) {
            if (left.get('received_at') === right.get('received_at')) {
                return (left.get('sent_at') || 0) - (right.get('sent_at') || 0);
            }

            return (left.get('received_at') || 0) - (right.get('received_at') || 0);
        },
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
            return new Promise(function(resolve) {
                return this.fetch({
                    index: {
                        // 'receipt' index on sent_at
                        name: 'receipt',
                        only: timestamp
                    }
                }).always(resolve);
            }.bind(this));
        },

        getLoadedUnreadCount: function() {
            return this.reduce(function(total, model) {
                var unread = model.get('unread') && model.isIncoming();
                return total + (unread ? 1 : 0);
            }, 0);
        },

        fetchConversation: function(conversationId, limit, unreadCount) {
            if (typeof limit !== 'number') {
                limit = 100;
            }
            if (typeof unreadCount !== 'number') {
                unreadCount = 0;
            }

            var startingLoadedUnread = 0;
            if (unreadCount > 0) {
                startingLoadedUnread = this.getLoadedUnreadCount();
            }
            return new Promise(function(resolve) {
                var upper;
                if (this.length === 0) {
                    // fetch the most recent messages first
                    upper = Number.MAX_VALUE;
                } else {
                    // not our first rodeo, fetch older messages.
                    upper = this.at(0).get('received_at');
                }
                var options = {remove: false, limit: limit};
                options.index = {
                    // 'conversation' index on [conversationId, received_at]
                    name  : 'conversation',
                    lower : [conversationId],
                    upper : [conversationId, upper],
                    order : 'desc'
                    // SELECT messages WHERE conversationId = this.id ORDER
                    // received_at DESC
                };
                this.fetch(options).always(resolve);
            }.bind(this)).then(function() {
                if (unreadCount > 0) {
                    var loadedUnread = this.getLoadedUnreadCount();
                    if (loadedUnread >= unreadCount) {
                        return;
                    }

                    if (startingLoadedUnread === loadedUnread) {
                        // that fetch didn't get us any more unread. stop fetching more.
                        return;
                    }

                    console.log('fetchConversation: doing another fetch to get all unread');
                    return this.fetchConversation(conversationId, limit, unreadCount);
                }
            }.bind(this));
        },

        fetchNextExpiring: function() {
            this.fetch({ index: { name: 'expires_at' }, limit: 1 });
        },

        fetchExpired: function() {
            console.log('loading expired messages');
            this.fetch({
                conditions: { expires_at: { $lte: Date.now() } },
                addIndividually: true
            });
        }
    });
})();
