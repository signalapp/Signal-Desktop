/* eslint-disable */

/* global Backbone: false */
/* global $: false */

/* global ConversationController: false */
/* global getAccountManager: false */
/* global Signal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */
/* global wrapDeferred: false */

;(async function() {
    'use strict';

    const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
    const { Errors, Message } = window.Signal.Types;
    const { upgradeMessageSchema } = window.Signal.Migrations;
    const { Migrations0DatabaseWithAttachmentData } = window.Signal.Migrations;
    const { Views } = window.Signal;

    // Implicitly used in `indexeddb-backbonejs-adapter`:
    // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
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
                Whisper.Registration.markDone();
                console.log('dispatching registration event');
                Whisper.events.trigger('registration_done');
            });
        }
        return accountManager;
    };

  /* eslint-enable */
  const cancelInitializationMessage = Views.Initialization.setMessage();
  console.log('Start IndexedDB migrations');

  console.log('Run migrations on database with attachment data');
  await Migrations0DatabaseWithAttachmentData.run({ Backbone });

  console.log('Storage fetch');
  storage.fetch();

  const idleDetector = new IdleDetector();
  let isMigrationWithIndexComplete = false;
  let isMigrationWithoutIndexComplete = false;
  idleDetector.on('idle', async () => {
    const NUM_MESSAGES_PER_BATCH = 1;

    if (!isMigrationWithIndexComplete) {
      const batchWithIndex = await MessageDataMigrator.processNext({
        BackboneMessage: Whisper.Message,
        BackboneMessageCollection: Whisper.MessageCollection,
        numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
        upgradeMessageSchema,
      });
      console.log('Upgrade message schema (with index):', batchWithIndex);
      isMigrationWithIndexComplete = batchWithIndex.done;
    }

    if (!isMigrationWithoutIndexComplete) {
      const database = Migrations0DatabaseWithAttachmentData.getDatabase();
      const batchWithoutIndex = await MessageDataMigrator.processNextBatchWithoutIndex({
        databaseName: database.name,
        minDatabaseVersion: database.version,
        numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
        upgradeMessageSchema,
      });
      console.log('Upgrade message schema (without index):', batchWithoutIndex);
      isMigrationWithoutIndexComplete = batchWithoutIndex.done;
    }

    const areAllMigrationsComplete = isMigrationWithIndexComplete &&
      isMigrationWithoutIndexComplete;
    if (areAllMigrationsComplete) {
      idleDetector.stop();
    }
  });
  /* eslint-disable */

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
      idleDetector.stop();

      if (messageReceiver) {
        messageReceiver.close().then(function() {
          Whisper.events.trigger('shutdown-complete');
        });
      } else {
        Whisper.events.trigger('shutdown-complete');
      }
    });

    Whisper.events.on('setupWithImport', function() {
      var appView = window.owsDesktopApp.appView;
      if (appView) {
        appView.openImporter();
      }
    });

    Whisper.events.on('setupAsNewDevice', function() {
      var appView = window.owsDesktopApp.appView;
      if (appView) {
        appView.openInstaller();
      }
    });

    Whisper.events.on('setupAsStandalone', function() {
      var appView = window.owsDesktopApp.appView;
      if (appView) {
        appView.openStandalone();
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

        cancelInitializationMessage();
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
        } else if (window.config.importMode) {
            appView.openImporter();
        } else {
            appView.openInstaller();
        }

        Whisper.events.on('showDebugLog', function() {
            appView.openDebugLog();
        });
        Whisper.events.on('showSettings', () => {
            if (!appView || !appView.inboxView) {
                console.log(
                    'background: Event: \'showSettings\':' +
                    ' Expected `appView.inboxView` to exist.'
                );
                return;
            }
            appView.inboxView.showSettings();
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
    async function connect(firstRun) {
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
        messageReceiver.addEventListener('configuration', onConfiguration);

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

    /* eslint-enable */
    const deviceId = textsecure.storage.user.getDeviceId();
    const { sendRequestConfigurationSyncMessage } = textsecure.messaging;
    const status = await Signal.Startup.syncReadReceiptConfiguration({
      deviceId,
      sendRequestConfigurationSyncMessage,
      storage,
    });
    console.log('Sync read receipt configuration status:', status);

    if (firstRun === true && deviceId !== '1') {
      const hasThemeSetting = Boolean(storage.get('theme-setting'));
      if (!hasThemeSetting && textsecure.storage.get('userAgent') === 'OWI') {
        storage.put('theme-setting', 'ios');
        onChangeTheme();
      }
      const syncRequest = new textsecure.SyncRequest(
        textsecure.messaging,
        messageReceiver
      );
      Whisper.events.trigger('contactsync:begin');
      syncRequest.addEventListener('success', () => {
        console.log('sync successful');
        storage.put('synced_at', Date.now());
        Whisper.events.trigger('contactsync');
      });
      syncRequest.addEventListener('timeout', () => {
        console.log('sync timed out');
        Whisper.events.trigger('contactsync');
      });

      if (Whisper.Import.isComplete()) {
        textsecure.messaging.sendRequestConfigurationSyncMessage().catch((e) => {
          console.log(e);
        });
      }
    }

    storage.onready(async () => {
      const shouldSkipAttachmentMigrationForNewUsers = firstRun === true;
      if (shouldSkipAttachmentMigrationForNewUsers) {
        const database = Migrations0DatabaseWithAttachmentData.getDatabase();
        const connection =
          await Signal.Database.open(database.name, database.version);
        await Signal.Settings.markAttachmentMigrationComplete(connection);
      }
      idleDetector.start();
    });
  }
  /* eslint-disable */

    function onChangeTheme() {
        var view = window.owsDesktopApp.appView;
        if (view) {
            view.applyTheme();
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
    function onConfiguration(ev) {
        storage.put('read-receipt-setting', ev.configuration.readReceipts);
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
            console.log('Invalid contact received:', Errors.toLogFormat(error));
            return;
        }

        return ConversationController.getOrCreateAndWait(id, 'private')
            .then(function(conversation) {
                var activeAt = conversation.get('active_at');

                // The idea is to make any new contact show up in the left pane. If
                //   activeAt is null, then this contact has been purposefully hidden.
                if (activeAt !== null) {
                    activeAt = activeAt || Date.now();
                }

                if (details.profileKey) {
                  conversation.set({profileKey: details.profileKey});
                }

                if (typeof details.blocked !== 'undefined') {
                    if (details.blocked) {
                        storage.addBlockedNumber(id);
                    } else {
                        storage.removeBlockedNumber(id);
                    }
                }

                return wrapDeferred(conversation.save({
                    name: details.name,
                    avatar: details.avatar,
                    color: details.color,
                    active_at: activeAt,
                })).then(function() {
                    const { expireTimer } = details;
                    const isValidExpireTimer = typeof expireTimer === 'number';
                    if (!isValidExpireTimer) {
                        console.log(
                            'Ignore invalid expire timer.',
                            'Expected numeric `expireTimer`, got:', expireTimer
                        );
                        return;
                    }

                    var source = textsecure.storage.user.getNumber();
                    var receivedAt = Date.now();
                    return conversation.updateExpirationTimer(
                        expireTimer,
                        source,
                        receivedAt,
                        {fromSync: true}
                    );
                });
            })
            .then(function() {
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
            })
            .then(ev.confirm)
            .catch(function(error) {
                console.log(
                    'onContactReceived error:',
                    Errors.toLogFormat(error)
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
                updates.left = false;
            } else {
                updates.left = true;
            }

            return wrapDeferred(conversation.save(updates)).then(function() {
                const { expireTimer } = details;
                const isValidExpireTimer = typeof expireTimer === 'number';
                if (!isValidExpireTimer) {
                    console.log(
                        'Ignore invalid expire timer.',
                        'Expected numeric `expireTimer`, got:', expireTimer
                    );
                    return;
                }

                var source = textsecure.storage.user.getNumber();
                var receivedAt = Date.now();
                return conversation.updateExpirationTimer(
                    expireTimer,
                    source,
                    receivedAt,
                    {fromSync: true}
                );
            }).then(ev.confirm);
        });
    }

  /* eslint-enable */

  // Descriptors
  const getGroupDescriptor = group => ({
    type: Message.GROUP,
    id: group.id,
  });

  // Matches event data from `libtextsecure` `MessageReceiver::handleSentMessage`:
  const getDescriptorForSent = ({ message, destination }) => (
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: destination }
  );

  // Matches event data from `libtextsecure` `MessageReceiver::handleDataMessage`:
  const getDescriptorForReceived = ({ message, source }) => (
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: source }
  );

  function createMessageHandler({
    createMessage,
    getMessageDescriptor,
    handleProfileUpdate,
  }) {
    return async (event) => {
      const { data, confirm } = event;

      const messageDescriptor = getMessageDescriptor(data);

      const { PROFILE_KEY_UPDATE } = textsecure.protobuf.DataMessage.Flags;
      // eslint-disable-next-line no-bitwise
      const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
      if (isProfileUpdate) {
        return handleProfileUpdate({ data, confirm, messageDescriptor });
      }

      const message = createMessage(data);
      const isDuplicate = await isMessageDuplicate(message);
      if (isDuplicate) {
        console.log('Received duplicate message', message.idForLogging());
        return event.confirm();
      }

      const upgradedMessage = await upgradeMessageSchema(data.message);
      await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );
      return message.handleDataMessage(
        upgradedMessage,
        event.confirm,
        { initialLoadComplete }
      );
    };
  }

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    const profileKey = data.message.profileKey.toArrayBuffer();
    const sender = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      'private'
    );
    await sender.setProfileKey(profileKey);
    return confirm();
  }

  const onMessageReceived = createMessageHandler({
    handleProfileUpdate: handleMessageReceivedProfileUpdate,
    getMessageDescriptor: getDescriptorForReceived,
    createMessage: initIncomingMessage,
  });

  // Sent:
  async function handleMessageSentProfileUpdate({ confirm, messageDescriptor }) {
    const conversation = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      messageDescriptor.type
    );
    await conversation.save({ profileSharing: true });
    return confirm();
  }

  function createSentMessage(data) {
    const now = Date.now();
    return new Whisper.Message({
      source: textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sent_at: data.timestamp,
      received_at: now,
      conversationId: data.destination,
      type: 'outgoing',
      sent: true,
      expirationStartTimestamp: data.expirationStartTimestamp,
    });
  }

  const onSentMessage = createMessageHandler({
    handleProfileUpdate: handleMessageSentProfileUpdate,
    getMessageDescriptor: getDescriptorForSent,
    createMessage: createSentMessage,
  });
  /* eslint-disable */

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
            console.log('isMessageDuplicate error:', Errors.toLogFormat(error));
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
        console.log('background onError:', Errors.toLogFormat(error));

        if (error.name === 'HTTPError' && (error.code == 401 || error.code == 403)) {
            Whisper.events.trigger('unauthorized');

            console.log('Client is no longer authorized; deleting local configuration');
            Whisper.Registration.remove();
            var previousNumberId = textsecure.storage.get('number_id');

            textsecure.storage.protocol.removeAllConfiguration().then(function() {
                // These two bits of data are important to ensure that the app loads up
                //   the conversation list, instead of showing just the QR code screen.
                Whisper.Registration.markEverDone();
                textsecure.storage.put('number_id', previousNumberId);
                console.log('Successfully cleared local configuration');
            }, function(error) {
               console.log(
                    'Something went wrong clearing local configuration',
                    error && error.stack ? error.stack : error
                );
            });

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
                'Invalid verified sync received:',
                Errors.toLogFormat(error)
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
