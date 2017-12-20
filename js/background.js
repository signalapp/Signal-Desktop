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

    var initialLoadComplete = false;
    window.owsDesktopApp = {};

    var title = window.config.name;
    if (window.config.environment !== 'production') {
        title += ' - ' + window.config.environment;
    }
    if (window.config.appInstance) {
        title += ' - ' + window.config.appInstance;
    }
    window.config.title = window.document.title = title;

    // start a background worker for ecc
    textsecure.startWorker('js/libsignal-protocol-worker.js');
    Whisper.KeyChangeListener.init(textsecure.storage.protocol);
    textsecure.storage.protocol.on('removePreKey', function() {
        getAccountManager().refreshPreKeys();
    });

    var SERVER_URL = window.config.serverUrl;
    var CDN_URL = window.config.cdnUrl;
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
                SERVER_URL, USERNAME, PASSWORD
            );
            accountManager.addEventListener('registration', function() {
                if (!Whisper.Registration.everDone()) {
                    storage.put('safety-numbers-approval', false);
                }
                Whisper.Registration.markDone();
                console.log('dispatching registration event');
                Whisper.events.trigger('registration_done');
            });
        }
        return accountManager;
    };

    storage.fetch();

    // We need this 'first' check because we don't want to start the app up any other time
    //   than the first time. And storage.fetch() will cause onready() to fire.
    var first = true;
    storage.onready(function() {
        if (!first) {
            return;
        }
        first = false;

        ConversationController.load().then(start, start);
    });

    Whisper.events.on('shutdown', function() {
      if (messageReceiver) {
        messageReceiver.close().then(function() {
          Whisper.events.trigger('shutdown-complete');
        });
      } else {
        Whisper.events.trigger('shutdown-complete');
      }
    });

    function start() {
        var currentVersion = window.config.version;
        var lastVersion = storage.get('version');
        var newVersion = !lastVersion || currentVersion !== lastVersion;
        storage.put('version', currentVersion);

        if (newVersion) {
            console.log('New version detected:', currentVersion);
        }

        window.dispatchEvent(new Event('storage_ready'));

        console.log('listening for registration events');
        Whisper.events.on('registration_done', function() {
            console.log('handling registration event');
            Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
            connect(true);
        });

        var appView = window.owsDesktopApp.appView = new Whisper.AppView({el: $('body')});

        Whisper.WallClockListener.init(Whisper.events);
        Whisper.ExpiringMessagesListener.init(Whisper.events);

        if (Whisper.Import.isIncomplete()) {
            console.log('Import was interrupted, showing import error screen');
            appView.openImporter();
        } else if (Whisper.Registration.everDone()) {
            Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
            connect();
            appView.openInbox({
                initialLoadComplete: initialLoadComplete
            });
        } else {
            appView.openInstallChoice();
        }

        Whisper.events.on('showDebugLog', function() {
            appView.openDebugLog();
        });
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
            showWindow();
            if (conversation) {
                appView.openConversation(conversation);
            } else {
                appView.openInbox({
                    initialLoadComplete: initialLoadComplete
                });
            }
        });
    }

    window.getSyncRequest = function() {
        return new textsecure.SyncRequest(textsecure.messaging, messageReceiver);
    };

    Whisper.events.on('start-shutdown', function() {
      if (messageReceiver) {
        messageReceiver.close().then(function() {
          Whisper.events.trigger('shutdown-complete');
        });
      } else {
        Whisper.events.trigger('shutdown-complete');
      }
    });


    var disconnectTimer = null;
    function onOffline() {
        console.log('offline');

        window.removeEventListener('offline', onOffline);
        window.addEventListener('online', onOnline);

        // We've received logs from Linux where we get an 'offline' event, then 30ms later
        //   we get an online event. This waits a bit after getting an 'offline' event
        //   before disconnecting the socket manually.
        disconnectTimer = setTimeout(disconnect, 1000);
    }

    function onOnline() {
        console.log('online');

        window.removeEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        if (disconnectTimer && isSocketOnline()) {
            console.log('Already online. Had a blip in online/offline status.');
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
            return;
        }
        if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
        }

        connect();
    }

    function isSocketOnline() {
        var socketStatus = window.getSocketStatus();
        return socketStatus === WebSocket.CONNECTING || socketStatus === WebSocket.OPEN;
    }

    function disconnect() {
        console.log('disconnect');

        // Clear timer, since we're only called when the timer is expired
        disconnectTimer = null;

        if (messageReceiver) {
            messageReceiver.close();
        }
    }

    var connectCount = 0;
    function connect(firstRun) {
        console.log('connect');

        // Bootstrap our online/offline detection, only the first time we connect
        if (connectCount === 0 && navigator.onLine) {
            window.addEventListener('offline', onOffline);
        }
        if (connectCount === 0 && !navigator.onLine) {
            console.log('Starting up offline; will connect when we have network access');
            window.addEventListener('online', onOnline);
            onEmpty(); // this ensures that the loading screen is dismissed
            return;
        }

        if (!Whisper.Registration.everDone()) { return; }
        if (Whisper.Import.isIncomplete()) { return; }

        if (messageReceiver) {
            messageReceiver.close();
        }

        var USERNAME = storage.get('number_id');
        var PASSWORD = storage.get('password');
        var mySignalingKey = storage.get('signaling_key');

        connectCount += 1;
        var options = {
            retryCached: connectCount === 1,
        };

        Whisper.Notifications.disable(); // avoid notification flood until empty

        // initialize the socket and start listening for messages
        messageReceiver = new textsecure.MessageReceiver(
            SERVER_URL, USERNAME, PASSWORD, mySignalingKey, options
        );
        messageReceiver.addEventListener('message', onMessageReceived);
        messageReceiver.addEventListener('delivery', onDeliveryReceipt);
        messageReceiver.addEventListener('contact', onContactReceived);
        messageReceiver.addEventListener('group', onGroupReceived);
        messageReceiver.addEventListener('sent', onSentMessage);
        messageReceiver.addEventListener('readSync', onReadSync);
        messageReceiver.addEventListener('read', onReadReceipt);
        messageReceiver.addEventListener('verified', onVerified);
        messageReceiver.addEventListener('error', onError);
        messageReceiver.addEventListener('empty', onEmpty);
        messageReceiver.addEventListener('progress', onProgress);
        messageReceiver.addEventListener('settings', onSettings);

        window.textsecure.messaging = new textsecure.MessageSender(
            SERVER_URL, USERNAME, PASSWORD, CDN_URL
        );

        // Because v0.43.2 introduced a bug that lost contact details, v0.43.4 introduces
        //   a one-time contact sync to restore all lost contact/group information. We
        //   disable this checking if a user is first registering.
        var key = 'chrome-contact-sync-v0.43.4';
        if (!storage.get(key)) {
            storage.put(key, true);

            if (!firstRun && textsecure.storage.user.getDeviceId() != '1') {
                window.getSyncRequest();
            }
        }

        // If we've just upgraded to read receipt support on desktop, kick off a
        // one-time configuration sync request to get the read-receipt setting
        // from the master device.
        var readReceiptConfigurationSync = 'read-receipt-configuration-sync';
        if (!storage.get(readReceiptConfigurationSync)) {

            if (!firstRun && textsecure.storage.user.getDeviceId() != '1') {
                textsecure.messaging.sendRequestConfigurationSyncMessage().then(function() {
                    storage.put(readReceiptConfigurationSync, true);
                }).catch(function(e) {
                    console.log(e);
                });
            }
        }

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

            if (Whisper.Import.isComplete()) {
              textsecure.messaging.sendRequestConfigurationSyncMessage().catch(function(e) {
                console.log(e);
              });
            }
        }
    }

    function onEmpty() {
        initialLoadComplete = true;

        var interval = setInterval(function() {
            var view = window.owsDesktopApp.appView;
            if (view) {
                clearInterval(interval);
                interval = null;
                view.onEmpty();
            }
        }, 500);

        Whisper.Notifications.enable();
    }
    function onProgress(ev) {
        var count = ev.count;

        var view = window.owsDesktopApp.appView;
        if (view) {
            view.onProgress(count);
        }
    }
    function onSettings(ev) {
        if (ev.settings.readReceipts) {
            storage.put('read-receipt-setting', true);
        } else {
            storage.put('read-receipt-setting', false);
        }
    }

    function onContactReceived(ev) {
        var details = ev.contactDetails;

        var id = details.number;

        if (id === textsecure.storage.user.getNumber()) {
          // special case for syncing details about ourselves
          if (details.profileKey) {
            console.log('Got sync message with our own profile key');
            storage.put('profileKey', details.profileKey);
          }
        }

        var c = new Whisper.Conversation({
            id: id
        });
        var error = c.validateNumber();
        if (error) {
            console.log('Invalid contact received', error && error.stack ? error.stack : error);
            return;
        }

        return ConversationController.getOrCreateAndWait(id, 'private')
            .then(function(conversation) {
                return new Promise(function(resolve, reject) {
                    var activeAt = conversation.get('active_at');

                    // The idea is to make any new contact show up in the left pane. If
                    //   activeAt is null, then this contact has been purposefully hidden.
                    if (activeAt !== null) {
                        activeAt = activeAt || Date.now();
                    }

                    if (details.profileKey) {
                      conversation.set({profileKey: details.profileKey});
                    }
                    conversation.save({
                        name: details.name,
                        avatar: details.avatar,
                        color: details.color,
                        active_at: activeAt,
                    }).then(resolve, reject);
                }).then(function() {
                    if (details.verified) {
                        var verified = details.verified;
                        var ev = new Event('verified');
                        ev.verified = {
                            state: verified.state,
                            destination: verified.destination,
                            identityKey: verified.identityKey.toArrayBuffer(),
                        };
                        ev.viaContactSync = true;
                        return onVerified(ev);
                    }
                });
            })
            .then(ev.confirm)
            .catch(function(error) {
                console.log(
                    'onContactReceived error:',
                    error && error.stack ? error.stack : error
                );
            });
    }

    function onGroupReceived(ev) {
        var details = ev.groupDetails;
        var id = details.id;

        return ConversationController.getOrCreateAndWait(id, 'group').then(function(conversation) {
            var updates = {
                name: details.name,
                members: details.members,
                avatar: details.avatar,
                type: 'group',
            };
            if (details.active) {
                var activeAt = conversation.get('active_at');

                // The idea is to make any new group show up in the left pane. If
                //   activeAt is null, then this group has been purposefully hidden.
                if (activeAt !== null) {
                    updates.active_at = activeAt || Date.now();
                }
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
        if (data.message.flags & textsecure.protobuf.DataMessage.Flags.PROFILE_KEY_UPDATE) {
            var profileKey = data.message.profileKey.toArrayBuffer();
            return ConversationController.getOrCreateAndWait(data.source, 'private').then(function(sender) {
              return sender.setProfileKey(profileKey).then(ev.confirm);
            });
        }
        var message = initIncomingMessage(data);

        return isMessageDuplicate(message).then(function(isDuplicate) {
            if (isDuplicate) {
                console.log('Received duplicate message', message.idForLogging());
                ev.confirm();
                return;
            }

            var type, id;
            if (data.message.group) {
                type = 'group';
                id = data.message.group.id;
            } else {
                type = 'private';
                id = data.source;
            }

            return ConversationController.getOrCreateAndWait(id, type).then(function() {
                return message.handleDataMessage(data.message, ev.confirm, {
                    initialLoadComplete: initialLoadComplete
                });
            });
        });
    }

    function onSentMessage(ev) {
        var now = new Date().getTime();
        var data = ev.data;

        var type, id;
        if (data.message.group) {
            type = 'group';
            id = data.message.group.id;
        } else {
            type = 'private';
            id = data.destination;
        }

        if (data.message.flags & textsecure.protobuf.DataMessage.Flags.PROFILE_KEY_UPDATE) {
            return ConversationController.getOrCreateAndWait(id, type).then(function(convo) {
              return convo.save({profileSharing: true}).then(ev.confirm);
            });
        }

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

        return isMessageDuplicate(message).then(function(isDuplicate) {
            if (isDuplicate) {
                console.log('Received duplicate message', message.idForLogging());
                ev.confirm();
                return;
            }

            return ConversationController.getOrCreateAndWait(id, type).then(function() {
                return message.handleDataMessage(data.message, ev.confirm, {
                    initialLoadComplete: initialLoadComplete
                });
            });
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
        var message = new Whisper.Message({
            source         : data.source,
            sourceDevice   : data.sourceDevice,
            sent_at        : data.timestamp,
            received_at    : data.receivedAt || Date.now(),
            conversationId : data.source,
            type           : 'incoming',
            unread         : 1
        });

        return message;
    }

    function onError(ev) {
        var error = ev.error;
        console.log('background onError:', error && error.stack ? error.stack : error);

        if (error.name === 'HTTPError' && (error.code == 401 || error.code == 403)) {
            Whisper.Registration.remove();
            Whisper.events.trigger('unauthorized');
            return;
        }

        if (error.name === 'HTTPError' && error.code == -1) {
            // Failed to connect to server
            if (navigator.onLine) {
                console.log('retrying in 1 minute');
                setTimeout(connect, 60000);

                Whisper.events.trigger('reconnectTimer');
            }
            return;
        }

        if (ev.proto) {
            if (error.name === 'MessageCounterError') {
                if (ev.confirm) {
                    ev.confirm();
                }
                // Ignore this message. It is likely a duplicate delivery
                // because the server lost our ack the first time.
                return;
            }
            var envelope = ev.proto;
            var message = initIncomingMessage(envelope);

            return message.saveErrors(error).then(function() {
                var id = message.get('conversationId');
                return ConversationController.getOrCreateAndWait(id, 'private').then(function(conversation) {
                    conversation.set({
                        active_at: Date.now(),
                        unreadCount: conversation.get('unreadCount') + 1
                    });

                    var conversation_timestamp = conversation.get('timestamp');
                    var message_timestamp = message.get('timestamp');
                    if (!conversation_timestamp || message_timestamp > conversation_timestamp) {
                        conversation.set({ timestamp: message.get('sent_at') });
                    }

                    conversation.trigger('newmessage', message);
                    conversation.notify(message);

                    if (ev.confirm) {
                        ev.confirm();
                    }

                    return new Promise(function(resolve, reject) {
                        conversation.save().then(resolve, reject);
                    });
                });
            });
        }

        throw error;
    }

    function onReadReceipt(ev) {
        var read_at   = ev.timestamp;
        var timestamp = ev.read.timestamp;
        var reader    = ev.read.reader;
        console.log('read receipt', reader, timestamp);

        if (!storage.get('read-receipt-setting')) {
          return ev.confirm();
        }

        var receipt = Whisper.ReadReceipts.add({
            reader    : reader,
            timestamp : timestamp,
            read_at   : read_at,
        });

        receipt.on('remove', ev.confirm);

        // Calling this directly so we can wait for completion
        return Whisper.ReadReceipts.onReceipt(receipt);
    }

    function onReadSync(ev) {
        var read_at   = ev.timestamp;
        var timestamp = ev.read.timestamp;
        var sender    = ev.read.sender;
        console.log('read sync', sender, timestamp);

        var receipt = Whisper.ReadSyncs.add({
            sender    : sender,
            timestamp : timestamp,
            read_at   : read_at
        });

        receipt.on('remove', ev.confirm);

        // Calling this directly so we can wait for completion
        return Whisper.ReadSyncs.onReceipt(receipt);
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

        return ConversationController.getOrCreateAndWait(number, 'private').then(function(contact) {
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
        var deliveryReceipt = ev.deliveryReceipt;
        console.log(
            'delivery receipt from',
            deliveryReceipt.source + '.' + deliveryReceipt.sourceDevice,
            deliveryReceipt.timestamp
        );

        var receipt = Whisper.DeliveryReceipts.add({
            timestamp: deliveryReceipt.timestamp,
            source: deliveryReceipt.source
        });

        ev.confirm();

        // Calling this directly so we can wait for completion
        return Whisper.DeliveryReceipts.onReceipt(receipt);
    }
})();
