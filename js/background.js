/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    window.onInvalidStateError = function(e) {
        console.log(e);
    };

    console.log('background page reloaded');
    extension.notification.init();

    // Close and reopen existing windows
    var open = false;
    extension.windows.getAll().forEach(function(appWindow) {
        open = true;
        appWindow.close();
    });

    // start a background worker for ecc
    textsecure.startWorker('/js/libsignal-protocol-worker.js');
    Whisper.KeyChangeListener.init(textsecure.storage.protocol);
    textsecure.storage.protocol.on('removePreKey', function() {
        getAccountManager().refreshPreKeys();
    });

    extension.onLaunched(function() {
        console.log('extension launched');
        storage.onready(function() {
            if (Whisper.Registration.everDone()) {
                openInbox();
            }
            if (!Whisper.Registration.isDone()) {
                extension.install();
            }
        });
    });

    var SERVER_URL = 'https://textsecure-service-staging.whispersystems.org';
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
        setUnreadCount(storage.get("unreadCount", 0));

        if (Whisper.Registration.isDone()) {
            extension.keepAwake();
            init();
        }

        console.log("listening for registration events");
        Whisper.events.on('registration_done', function() {
            console.log("handling registration event");
            extension.keepAwake();
            init(true);
        });

        if (open) {
            openInbox();
        }

        Whisper.WallClockListener.init(Whisper.events);
        Whisper.RotateSignedPreKeyListener.init(Whisper.events);
        Whisper.ExpiringMessagesListener.init(Whisper.events);
    });

    window.getSyncRequest = function() {
        return new textsecure.SyncRequest(textsecure.messaging, messageReceiver);
    };

    function init(firstRun) {
        window.removeEventListener('online', init);
        if (!Whisper.Registration.isDone()) { return; }

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
        messageReceiver.addEventListener('verification', onVerification);
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
        var contactDetails = ev.contactDetails;

        var c = new Whisper.Conversation({
            name: contactDetails.name,
            id: contactDetails.number,
            avatar: contactDetails.avatar,
            color: contactDetails.color,
            type: 'private',
            active_at: Date.now()
        });
        var error;
        if ((error = c.validateNumber())) {
          console.log(error.stack);
          return;
        }

        ConversationController.create(c).save();
    }

    function onGroupReceived(ev) {
        var groupDetails = ev.groupDetails;
        var attributes = {
            id: groupDetails.id,
            name: groupDetails.name,
            members: groupDetails.members,
            avatar: groupDetails.avatar,
            type: 'group',
        };
        if (groupDetails.active) {
            attributes.active_at = Date.now();
        } else {
            attributes.left = true;
        }
        var conversation = ConversationController.create(attributes);
        conversation.save();
    }

    function onMessageReceived(ev) {
        var data = ev.data;
        var message = initIncomingMessage(data.source, data.timestamp);
        message.handleDataMessage(data.message);
    }

    function onSentMessage(ev) {
        var now = new Date().getTime();
        var data = ev.data;

        var message = new Whisper.Message({
            source         : textsecure.storage.user.getNumber(),
            sent_at        : data.timestamp,
            received_at    : now,
            conversationId : data.destination,
            type           : 'outgoing',
            sent           : true,
            expirationStartTimestamp: data.expirationStartTimestamp,
        });

        message.handleDataMessage(data.message);
    }

    function initIncomingMessage(source, timestamp) {
        var now = new Date().getTime();

        var message = new Whisper.Message({
            source         : source,
            sent_at        : timestamp,
            received_at    : now,
            conversationId : source,
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
            extension.install();
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
        Whisper.ReadReceipts.add({
            sender    : sender,
            timestamp : timestamp,
            read_at   : read_at
        });
    }

    function onVerification(ev) {
        var number   = ev.verification.destination;
        var key      = ev.verification.identityKey;
        var state;

        console.log('got verification sync for', number, state);

        switch(ev.verification.state) {
          case textsecure.protobuf.SyncMessage.Verification.State.DEFAULT:
            state = 'DEFAULT';
            break;
          case textsecure.protobuf.SyncMessage.Verification.State.VERIFIED:
            state = 'VERIFIED';
            break;
          case textsecure.protobuf.SyncMessage.Verification.State.NO_LONGER_VERIFIED:
            state = 'UNVERIFIED';
            break;
        }

        var contact = ConversationController.get(number);
        if (!contact) {
            return;
        }

        if (state === 'DEFAULT') {
            contact.setVerifiedDefault({viaSyncMessage: true, key: key});
        } else if (state === 'VERIFIED') {
            contact.setVerified({viaSyncMessage: true, key: key});
        }
    }

    function onDeliveryReceipt(ev) {
        var pushMessage = ev.proto;
        var timestamp = pushMessage.timestamp.toNumber();
        console.log(
            'delivery receipt from',
            pushMessage.source + '.' + pushMessage.sourceDevice,
            timestamp
        );

        Whisper.DeliveryReceipts.add({
            timestamp: timestamp, source: pushMessage.source
        });
    }

    window.owsDesktopApp = {
        getAppView: function(destWindow) {

            var self = this;

            return ConversationController.updateInbox().then(function() {
                try {
                    if (self.inboxView) { self.inboxView.remove(); }
                    self.inboxView = new Whisper.InboxView({model: self, window: destWindow});
                    self.openConversation(getOpenConversation());

                    return self.inboxView;

                } catch (e) {
                    console.log(e);
                }
            });
        },
        openConversation: function(conversation) {
            if (this.inboxView && conversation) {
                this.inboxView.openConversation(null, conversation);
            }
        }
    };

    Whisper.events.on('unauthorized', function() {
        if (owsDesktopApp.inboxView) {
            owsDesktopApp.inboxView.networkStatusView.update();
        }
    });
    Whisper.events.on('reconnectTimer', function() {
        if (owsDesktopApp.inboxView) {
            owsDesktopApp.inboxView.networkStatusView.setSocketReconnectInterval(60000);
        }
    });

    chrome.commands.onCommand.addListener(function(command) {
        if (command === 'show_signal') {
            openInbox();
        }
    });

})();
