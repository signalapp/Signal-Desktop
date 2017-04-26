/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    window.onInvalidStateError = function(e) {
        console.log(e);
    };

    console.log('background page reloaded');
    console.log('environment:', window.config.environment);
    extension.notification.init();

    // start a background worker for ecc
    textsecure.startWorker('js/libsignal-protocol-worker.js');
    Whisper.KeyChangeListener.init(textsecure.storage.protocol);
    textsecure.storage.protocol.on('removePreKey', function() {
        getAccountManager().refreshPreKeys();
    });

    var SERVER_URL = window.config.serverUrl;
    var SERVER_PORTS = [80, 4433, 8443];
    var messageReceiver;
    window.getSocketStatus = function() {
        if (messageReceiver) {
            return messageReceiver.getStatus();
        } else {
            return -1;
        }
    };
    Whisper.events = _.clone(Backbone.Events);
    var accountManager;
    window.getAccountManager = function() {
        if (!accountManager) {
            var USERNAME = storage.get('number_id');
            var PASSWORD = storage.get('password');
            accountManager = new textsecure.AccountManager(
                SERVER_URL, SERVER_PORTS, USERNAME, PASSWORD
            );
            accountManager.addEventListener('registration', function() {
                if (!Whisper.Registration.everDone()) {
                    storage.put('safety-numbers-approval', false);
                }
                Whisper.Registration.markDone();
                console.log("dispatching registration event");
                Whisper.events.trigger('registration_done');
            });
        }
        return accountManager;
    };

    storage.fetch();
    storage.onready(function() {
        window.dispatchEvent(new Event('storage_ready'));

        console.log("listening for registration events");
        Whisper.events.on('registration_done', function() {
            console.log("handling registration event");
            extension.keepAwake();
            init(true);
        });

        var appView = new Whisper.AppView({el: $('body') });

        Whisper.WallClockListener.init(Whisper.events);
        Whisper.RotateSignedPreKeyListener.init(Whisper.events);
        Whisper.ExpiringMessagesListener.init(Whisper.events);

        if (Whisper.Registration.everDone()) {
            init();
            appView.openInbox();
        } else {
            appView.openInstaller();
        }

        Whisper.events.on('unauthorized', function() {
            appView.inboxView.networkStatusView.update();
        });
        Whisper.events.on('reconnectTimer', function() {
            appView.inboxView.networkStatusView.setSocketReconnectInterval(60000);
        });
        Whisper.events.on('contactsync', function() {
          if (appView.installView) {
              appView.openInbox();
          }
        });
        Whisper.events.on('contactsync:begin', function() {
          if (appView.installView && appView.installView.showSync) {
              appView.installView.showSync();
          }
        });

        Whisper.Notifications.on('click', function(conversation) {
            if (conversation) {
              appView.openConversation(conversation);
            } else {
              appView.openInbox();
            }
        });
    });

    window.getSyncRequest = function() {
        return new textsecure.SyncRequest(textsecure.messaging, messageReceiver);
    };

    function init(firstRun) {
        window.removeEventListener('online', init);

        if (messageReceiver) { messageReceiver.close(); }

        var USERNAME = storage.get('number_id');
        var PASSWORD = storage.get('password');
        var mySignalingKey = storage.get('signaling_key');

        // initialize the socket and start listening for messages
        messageReceiver = new textsecure.MessageReceiver(
            SERVER_URL, SERVER_PORTS, USERNAME, PASSWORD, mySignalingKey
        );
        messageReceiver.addEventListener('message', onMessageReceived);
        messageReceiver.addEventListener('receipt', onDeliveryReceipt);
        messageReceiver.addEventListener('contact', onContactReceived);
        messageReceiver.addEventListener('group', onGroupReceived);
        messageReceiver.addEventListener('sent', onSentMessage);
        messageReceiver.addEventListener('read', onReadReceipt);
        messageReceiver.addEventListener('verified', onVerified);
        messageReceiver.addEventListener('error', onError);


        window.textsecure.messaging = new textsecure.MessageSender(
            SERVER_URL, SERVER_PORTS, USERNAME, PASSWORD
        );

        if (firstRun === true && textsecure.storage.user.getDeviceId() != '1') {
            if (!storage.get('theme-setting') && textsecure.storage.get('userAgent') === 'OWI') {
                storage.put('theme-setting', 'ios');
            }
            var syncRequest = new textsecure.SyncRequest(textsecure.messaging, messageReceiver);
            Whisper.events.trigger('contactsync:begin');
            syncRequest.addEventListener('success', function() {
                console.log('sync successful');
                storage.put('synced_at', Date.now());
                Whisper.events.trigger('contactsync');
            });
            syncRequest.addEventListener('timeout', function() {
                console.log('sync timed out');
                Whisper.events.trigger('contactsync');
            });
        }
    }

    function onContactReceived(ev) {
        var details = ev.contactDetails;

        var id = details.number;
        var c = new Whisper.Conversation({
            id: id
        });
        var error = c.validateNumber();
        if (error) {
            console.log('Invalid contact received', error && error.stack ? error.stack : error);
            return;
        }

        return ConversationController.findOrCreatePrivateById(id).then(function(conversation) {
            return new Promise(function(resolve, reject) {
                conversation.save({
                    name: details.name,
                    avatar: details.avatar,
                    color: details.color,
                    active_at: conversation.get('active_at') || Date.now(),
                }).then(resolve, reject);
            });
        }).then(ev.confirm);
    }

    function onGroupReceived(ev) {
        var details = ev.groupDetails;
        var id = details.id;

        return ConversationController.findOrCreateById(id).then(function(conversation) {
            var updates = {
                name: details.name,
                members: details.members,
                avatar: details.avatar,
                type: 'group',
            };
            if (details.active) {
                updates.active_at = Date.now();
            } else {
                updates.left = true;
            }
            return new Promise(function(resolve, reject) {
                conversation.save(updates).then(resolve, reject);
            }).then(ev.confirm);
        });
    }

    function onMessageReceived(ev) {
        var data = ev.data;
        var message = initIncomingMessage(data);

        isMessageDuplicate(message).then(function(isDuplicate) {
            if (isDuplicate) {
                console.log('Received duplicate message', message.idForLogging());
                ev.confirm();
                return;
            }

            message.handleDataMessage(data.message, ev.confirm);
        });
    }

    function onSentMessage(ev) {
        var now = new Date().getTime();
        var data = ev.data;

        var message = new Whisper.Message({
            source         : textsecure.storage.user.getNumber(),
            sourceDevice   : data.device,
            sent_at        : data.timestamp,
            received_at    : now,
            conversationId : data.destination,
            type           : 'outgoing',
            sent           : true,
            expirationStartTimestamp: data.expirationStartTimestamp,
        });

        isMessageDuplicate(message).then(function(isDuplicate) {
            if (isDuplicate) {
                console.log('Received duplicate message', message.idForLogging());
                ev.confirm();
                return;
            }

            message.handleDataMessage(data.message, ev.confirm);
        });
    }

    function isMessageDuplicate(message) {
        return new Promise(function(resolve) {
            var fetcher = new Whisper.Message();
            var options = {
                index: {
                    name: 'unique',
                    value: [
                        message.get('source'),
                        message.get('sourceDevice'),
                        message.get('sent_at')
                    ]
                }
            };

            fetcher.fetch(options).always(function() {
                if (fetcher.get('id')) {
                    return resolve(true);
                }

                return resolve(false);
            });
        }).catch(function(error) {
            console.log('isMessageDuplicate error:', error && error.stack ? error.stack : error);
            return false;
        });
    }

    function initIncomingMessage(data) {
        var now = new Date().getTime();

        var message = new Whisper.Message({
            source         : data.source,
            sourceDevice   : data.sourceDevice,
            sent_at        : data.timestamp,
            received_at    : now,
            conversationId : data.source,
            type           : 'incoming',
            unread         : 1
        });

        return message;
    }

    function onError(ev) {
        var e = ev.error;
        console.log(e);
        console.log(e.stack);

        if (e.name === 'HTTPError' && (e.code == 401 || e.code == 403)) {
            Whisper.Registration.remove();
            Whisper.events.trigger('unauthorized');
            return;
        }

        if (e.name === 'HTTPError' && e.code == -1) {
            // Failed to connect to server
            if (navigator.onLine) {
                console.log('retrying in 1 minute');
                setTimeout(init, 60000);

                Whisper.events.trigger('reconnectTimer');
            } else {
                console.log('offline');
                messageReceiver.close();
                window.addEventListener('online', init);
            }
            return;
        }

        if (ev.proto) {
            if (e.name === 'MessageCounterError') {
                // Ignore this message. It is likely a duplicate delivery
                // because the server lost our ack the first time.
                return;
            }
            var envelope = ev.proto;
            var message = initIncomingMessage(envelope.source, envelope.timestamp.toNumber());
            message.saveErrors(e).then(function() {
                ConversationController.findOrCreatePrivateById(message.get('conversationId')).then(function(conversation) {
                    conversation.set({
                        active_at: Date.now(),
                        unreadCount: conversation.get('unreadCount') + 1
                    });

                    var conversation_timestamp = conversation.get('timestamp');
                    var message_timestamp = message.get('timestamp');
                    if (!conversation_timestamp || message_timestamp > conversation_timestamp) {
                        conversation.set({ timestamp: message.get('sent_at') });
                    }
                    conversation.save();
                    conversation.trigger('newmessage', message);
                    conversation.notify(message);
                });
            });
            return;
        }

        throw e;
    }

    function onReadReceipt(ev) {
        var read_at   = ev.timestamp;
        var timestamp = ev.read.timestamp;
        var sender    = ev.read.sender;
        console.log('read receipt ', sender, timestamp);
        var receipt = Whisper.ReadReceipts.add({
            sender    : sender,
            timestamp : timestamp,
            read_at   : read_at
        });
        receipt.on('remove', ev.confirm);
    }

    function onVerified(ev) {
        var number   = ev.verified.destination;
        var key      = ev.verified.identityKey;
        var state;

        var c = new Whisper.Conversation({
            id: number
        });
        var error = c.validateNumber();
        if (error) {
            console.log(
                'Invalid verified sync received',
                error && error.stack ? error.stack : error
            );
            return;
        }

        switch(ev.verified.state) {
            case textsecure.protobuf.Verified.State.DEFAULT:
                state = 'DEFAULT';
                break;
            case textsecure.protobuf.Verified.State.VERIFIED:
                state = 'VERIFIED';
                break;
            case textsecure.protobuf.Verified.State.UNVERIFIED:
                state = 'UNVERIFIED';
                break;
        }

        console.log('got verified sync for', number, state,
            ev.viaContactSync ? 'via contact sync' : '');

        return ConversationController.findOrCreatePrivateById(number).then(function(contact) {
            var options = {
                viaSyncMessage: true,
                viaContactSync: ev.viaContactSync,
                key: key
            };

            if (state === 'VERIFIED') {
                return contact.setVerified(options).then(ev.confirm);
            } else if (state === 'DEFAULT') {
                return contact.setVerifiedDefault(options).then(ev.confirm);
            } else {
                return contact.setUnverified(options).then(ev.confirm);
            }
        });
    }

    function onDeliveryReceipt(ev) {
        var pushMessage = ev.proto;
        var timestamp = pushMessage.timestamp.toNumber();
        console.log(
            'delivery receipt from',
            pushMessage.source + '.' + pushMessage.sourceDevice,
            timestamp
        );

        var receipt = Whisper.DeliveryReceipts.add({
            timestamp: timestamp,
            source: pushMessage.source
        });
        receipt.on('remove', ev.confirm);
    }

})();
