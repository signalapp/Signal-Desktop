/* global Backbone: false */
/* global $: false */

/* global ConversationController: false */
/* global getAccountManager: false */
/* global Signal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */
/* global wrapDeferred: false */
/* global _: false */

// eslint-disable-next-line func-names
(async function() {
  'use strict';

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const { Errors, Message } = window.Signal.Types;
  const { upgradeMessageSchema } = window.Signal.Migrations;
  const { Migrations0DatabaseWithAttachmentData } = window.Signal.Migrations;
  const { Views } = window.Signal;

  // Implicitly used in `indexeddb-backbonejs-adapter`:
  // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
  window.onInvalidStateError = e => console.log(e);

  console.log('background page reloaded');
  console.log('environment:', window.config.environment);

  let initialLoadComplete = false;
  window.owsDesktopApp = {};

  let title = window.config.name;
  if (window.config.environment !== 'production') {
    title += ` - ${window.config.environment}`;
  }
  if (window.config.appInstance) {
    title += ` - ${window.config.appInstance}`;
  }
  window.config.title = title;
  window.document.title = title;

  // start a background worker for ecc
  textsecure.startWorker('js/libsignal-protocol-worker.js');
  Whisper.KeyChangeListener.init(textsecure.storage.protocol);
  textsecure.storage.protocol.on('removePreKey', () => {
    getAccountManager().refreshPreKeys();
  });

  const SERVER_URL = window.config.serverUrl;
  const CDN_URL = window.config.cdnUrl;
  let messageReceiver;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    return -1;
  };
  Whisper.events = _.clone(Backbone.Events);
  let accountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const USERNAME = storage.get('number_id');
      const PASSWORD = storage.get('password');
      accountManager = new textsecure.AccountManager(
        SERVER_URL,
        USERNAME,
        PASSWORD
      );
      accountManager.addEventListener('registration', () => {
        Whisper.Registration.markDone();
        console.log('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

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
      const batchWithoutIndex = await MessageDataMigrator.processNextBatchWithoutIndex(
        {
          databaseName: database.name,
          minDatabaseVersion: database.version,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
        }
      );
      console.log('Upgrade message schema (without index):', batchWithoutIndex);
      isMigrationWithoutIndexComplete = batchWithoutIndex.done;
    }

    const areAllMigrationsComplete =
      isMigrationWithIndexComplete && isMigrationWithoutIndexComplete;
    if (areAllMigrationsComplete) {
      idleDetector.stop();
    }
  });

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    try {
      await ConversationController.load();
    } finally {
      start();
    }
  });

  Whisper.events.on('shutdown', async () => {
    idleDetector.stop();

    if (messageReceiver) {
      await messageReceiver.close();
    }
    Whisper.events.trigger('shutdown-complete');
  });

  Whisper.events.on('setupWithImport', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openImporter();
    }
  });

  Whisper.events.on('setupAsNewDevice', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openInstaller();
    }
  });

  Whisper.events.on('setupAsStandalone', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openStandalone();
    }
  });

  function start() {
    const currentVersion = window.config.version;
    const lastVersion = storage.get('version');
    const newVersion = !lastVersion || currentVersion !== lastVersion;
    storage.put('version', currentVersion);

    if (newVersion) {
      console.log('New version detected:', currentVersion);
    }

    window.dispatchEvent(new Event('storage_ready'));

    console.log('listening for registration events');
    Whisper.events.on('registration_done', () => {
      console.log('handling registration event');
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      connect(true);
    });

    cancelInitializationMessage();
    const appView = new Whisper.AppView({
      el: $('body'),
    });
    window.owsDesktopApp.appView = appView;

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);

    if (Whisper.Import.isIncomplete()) {
      console.log('Import was interrupted, showing import error screen');
      appView.openImporter();
    } else if (Whisper.Registration.everDone()) {
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.config.importMode) {
      appView.openImporter();
    } else {
      appView.openInstaller();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });
    Whisper.events.on('showSettings', () => {
      if (!appView || !appView.inboxView) {
        console.log(
          "background: Event: 'showSettings':" +
            ' Expected `appView.inboxView` to exist.'
        );
        return;
      }
      appView.inboxView.showSettings();
    });
    Whisper.events.on('unauthorized', () => {
      appView.inboxView.networkStatusView.update();
    });
    Whisper.events.on('reconnectTimer', () => {
      appView.inboxView.networkStatusView.setSocketReconnectInterval(60000);
    });
    Whisper.events.on('contactsync', () => {
      if (appView.installView) {
        appView.openInbox();
      }
    });

    window.addEventListener('focus', () => Whisper.Notifications.clear());
    window.addEventListener('unload', () => Whisper.Notifications.fastClear());

    Whisper.events.on('showConversation', conversation => {
      if (appView) {
        appView.openConversation(conversation);
      }
    });

    Whisper.Notifications.on('click', conversation => {
      window.showWindow();
      if (conversation) {
        appView.openConversation(conversation);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });
  }

  window.getSyncRequest = () =>
    new textsecure.SyncRequest(textsecure.messaging, messageReceiver);

  Whisper.events.on('start-shutdown', async () => {
    if (messageReceiver) {
      await messageReceiver.close();
    }
    Whisper.events.trigger('shutdown-complete');
  });

  let disconnectTimer = null;
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
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === WebSocket.CONNECTING || socketStatus === WebSocket.OPEN
    );
  }

  function disconnect() {
    console.log('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      messageReceiver.close();
    }
  }

  let connectCount = 0;
  async function connect(firstRun) {
    console.log('connect');

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      console.log(
        'Starting up offline; will connect when we have network access'
      );
      window.addEventListener('online', onOnline);
      onEmpty(); // this ensures that the loading screen is dismissed
      return;
    }

    if (!Whisper.Registration.everDone()) {
      return;
    }
    if (Whisper.Import.isIncomplete()) {
      return;
    }

    if (messageReceiver) {
      messageReceiver.close();
    }

    const USERNAME = storage.get('number_id');
    const PASSWORD = storage.get('password');
    const mySignalingKey = storage.get('signaling_key');

    connectCount += 1;
    const options = {
      retryCached: connectCount === 1,
    };

    Whisper.Notifications.disable(); // avoid notification flood until empty

    // initialize the socket and start listening for messages
    messageReceiver = new textsecure.MessageReceiver(
      SERVER_URL,
      USERNAME,
      PASSWORD,
      mySignalingKey,
      options
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
      SERVER_URL,
      USERNAME,
      PASSWORD,
      CDN_URL
    );

    // Because v0.43.2 introduced a bug that lost contact details, v0.43.4 introduces
    //   a one-time contact sync to restore all lost contact/group information. We
    //   disable this checking if a user is first registering.
    const key = 'chrome-contact-sync-v0.43.4';
    if (!storage.get(key)) {
      storage.put(key, true);

      // eslint-disable-next-line eqeqeq
      if (!firstRun && textsecure.storage.user.getDeviceId() != '1') {
        window.getSyncRequest();
      }
    }

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
        textsecure.messaging.sendRequestConfigurationSyncMessage().catch(e => {
          console.log(e);
        });
      }
    }

    storage.onready(async () => {
      const shouldSkipAttachmentMigrationForNewUsers = firstRun === true;
      if (shouldSkipAttachmentMigrationForNewUsers) {
        const database = Migrations0DatabaseWithAttachmentData.getDatabase();
        const connection = await Signal.Database.open(
          database.name,
          database.version
        );
        await Signal.Settings.markAttachmentMigrationComplete(connection);
      }
      idleDetector.start();
    });
  }

  function onChangeTheme() {
    const view = window.owsDesktopApp.appView;
    if (view) {
      view.applyTheme();
    }
  }
  function onEmpty() {
    initialLoadComplete = true;

    let interval = setInterval(() => {
      const view = window.owsDesktopApp.appView;
      if (view) {
        clearInterval(interval);
        interval = null;
        view.onEmpty();
      }
    }, 500);

    Whisper.Notifications.enable();
  }
  function onProgress(ev) {
    const { count } = ev;

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(count);
    }
  }
  function onConfiguration(ev) {
    storage.put('read-receipt-setting', ev.configuration.readReceipts);
  }

  async function onContactReceived(ev) {
    const details = ev.contactDetails;

    const id = details.number;

    if (id === textsecure.storage.user.getNumber()) {
      // special case for syncing details about ourselves
      if (details.profileKey) {
        console.log('Got sync message with our own profile key');
        storage.put('profileKey', details.profileKey);
      }
    }

    const c = new Whisper.Conversation({
      id,
    });
    const validationError = c.validateNumber();
    if (validationError) {
      console.log(
        'Invalid contact received:',
        Errors.toLogFormat(validationError)
      );
      return;
    }

    try {
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );
      let activeAt = conversation.get('active_at');

      // The idea is to make any new contact show up in the left pane. If
      //   activeAt is null, then this contact has been purposefully hidden.
      if (activeAt !== null) {
        activeAt = activeAt || Date.now();
      }

      if (details.profileKey) {
        conversation.set({ profileKey: details.profileKey });
      }

      if (typeof details.blocked !== 'undefined') {
        if (details.blocked) {
          storage.addBlockedNumber(id);
        } else {
          storage.removeBlockedNumber(id);
        }
      }

      await wrapDeferred(
        conversation.save({
          name: details.name,
          avatar: details.avatar,
          color: details.color,
          active_at: activeAt,
        })
      );
      const { expireTimer } = details;
      const isValidExpireTimer = typeof expireTimer === 'number';
      if (!isValidExpireTimer) {
        console.log(
          'Ignore invalid expire timer.',
          'Expected numeric `expireTimer`, got:',
          expireTimer
        );
        return;
      }

      const source = textsecure.storage.user.getNumber();
      const receivedAt = Date.now();

      await conversation.updateExpirationTimer(
        expireTimer,
        source,
        receivedAt,
        { fromSync: true }
      );

      if (details.verified) {
        const { verified } = details;
        const verifiedEvent = new Event('verified');
        verifiedEvent.verified = {
          state: verified.state,
          destination: verified.destination,
          identityKey: verified.identityKey.toArrayBuffer(),
        };
        verifiedEvent.viaContactSync = true;
        await onVerified(verifiedEvent);
      }

      ev.confirm();
    } catch (error) {
      console.log('onContactReceived error:', Errors.toLogFormat(error));
    }
  }

  async function onGroupReceived(ev) {
    const details = ev.groupDetails;
    const { id } = details;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );
    const updates = {
      name: details.name,
      members: details.members,
      avatar: details.avatar,
      type: 'group',
    };
    if (details.active) {
      const activeAt = conversation.get('active_at');

      // The idea is to make any new group show up in the left pane. If
      //   activeAt is null, then this group has been purposefully hidden.
      if (activeAt !== null) {
        updates.active_at = activeAt || Date.now();
      }
      updates.left = false;
    } else {
      updates.left = true;
    }

    await wrapDeferred(conversation.save(updates));
    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (!isValidExpireTimer) {
      console.log(
        'Ignore invalid expire timer.',
        'Expected numeric `expireTimer`, got:',
        expireTimer
      );
      return;
    }

    const source = textsecure.storage.user.getNumber();
    const receivedAt = Date.now();
    await conversation.updateExpirationTimer(expireTimer, source, receivedAt, {
      fromSync: true,
    });

    ev.confirm();
  }

  // Descriptors
  const getGroupDescriptor = group => ({
    type: Message.GROUP,
    id: group.id,
  });

  // Matches event data from `libtextsecure` `MessageReceiver::handleSentMessage`:
  const getDescriptorForSent = ({ message, destination }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: destination };

  // Matches event data from `libtextsecure` `MessageReceiver::handleDataMessage`:
  const getDescriptorForReceived = ({ message, source }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: source };

  function createMessageHandler({
    createMessage,
    getMessageDescriptor,
    handleProfileUpdate,
  }) {
    return async event => {
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
      return message.handleDataMessage(upgradedMessage, event.confirm, {
        initialLoadComplete,
      });
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
  async function handleMessageSentProfileUpdate({
    confirm,
    messageDescriptor,
  }) {
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

  function isMessageDuplicate(message) {
    return new Promise(resolve => {
      const fetcher = new Whisper.Message();
      const options = {
        index: {
          name: 'unique',
          value: [
            message.get('source'),
            message.get('sourceDevice'),
            message.get('sent_at'),
          ],
        },
      };

      fetcher.fetch(options).always(() => {
        if (fetcher.get('id')) {
          return resolve(true);
        }

        return resolve(false);
      });
    }).catch(error => {
      console.log('isMessageDuplicate error:', Errors.toLogFormat(error));
      return false;
    });
  }

  function initIncomingMessage(data) {
    const message = new Whisper.Message({
      source: data.source,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      received_at: data.receivedAt || Date.now(),
      conversationId: data.source,
      type: 'incoming',
      unread: 1,
    });

    return message;
  }

  async function onError(ev) {
    const { error } = ev;
    console.log('background onError:', Errors.toLogFormat(error));

    if (
      error.name === 'HTTPError' &&
      (error.code === 401 || error.code === 403)
    ) {
      Whisper.events.trigger('unauthorized');

      console.log(
        'Client is no longer authorized; deleting local configuration'
      );
      Whisper.Registration.remove();
      const previousNumberId = textsecure.storage.get('number_id');

      try {
        await textsecure.storage.protocol.removeAllConfiguration();
        // These two bits of data are important to ensure that the app loads up
        //   the conversation list, instead of showing just the QR code screen.
        Whisper.Registration.markEverDone();
        textsecure.storage.put('number_id', previousNumberId);
        console.log('Successfully cleared local configuration');
      } catch (eraseError) {
        console.log(
          'Something went wrong clearing local configuration',
          eraseError && eraseError.stack ? eraseError.stack : eraseError
        );
      }

      return;
    }

    if (error.name === 'HTTPError' && error.code === -1) {
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
      const envelope = ev.proto;
      const message = initIncomingMessage(envelope);

      await message.saveErrors(error);
      const id = message.get('conversationId');
      const conversation = await ConversationController.getOrCreateAndWait(
        id,
        'private'
      );
      conversation.set({
        active_at: Date.now(),
        unreadCount: conversation.get('unreadCount') + 1,
      });

      const conversationTimestamp = conversation.get('timestamp');
      const messageTimestamp = message.get('timestamp');
      if (!conversationTimestamp || messageTimestamp > conversationTimestamp) {
        conversation.set({ timestamp: message.get('sent_at') });
      }

      conversation.trigger('newmessage', message);
      conversation.notify(message);

      if (ev.confirm) {
        ev.confirm();
      }

      await wrapDeferred(conversation.save());
    }

    throw error;
  }

  function onReadReceipt(ev) {
    const readAt = ev.timestamp;
    const { timestamp } = ev.read;
    const { reader } = ev.read;
    console.log('read receipt', reader, timestamp);

    if (!storage.get('read-receipt-setting')) {
      return ev.confirm();
    }

    const receipt = Whisper.ReadReceipts.add({
      reader,
      timestamp,
      read_at: readAt,
    });

    receipt.on('remove', ev.confirm);

    // Calling this directly so we can wait for completion
    return Whisper.ReadReceipts.onReceipt(receipt);
  }

  function onReadSync(ev) {
    const readAt = ev.timestamp;
    const { timestamp } = ev.read;
    const { sender } = ev.read;
    console.log('read sync', sender, timestamp);

    const receipt = Whisper.ReadSyncs.add({
      sender,
      timestamp,
      read_at: readAt,
    });

    receipt.on('remove', ev.confirm);

    // Calling this directly so we can wait for completion
    return Whisper.ReadSyncs.onReceipt(receipt);
  }

  async function onVerified(ev) {
    const number = ev.verified.destination;
    const key = ev.verified.identityKey;
    let state;

    const c = new Whisper.Conversation({
      id: number,
    });
    const error = c.validateNumber();
    if (error) {
      console.log('Invalid verified sync received:', Errors.toLogFormat(error));
      return;
    }

    switch (ev.verified.state) {
      case textsecure.protobuf.Verified.State.DEFAULT:
        state = 'DEFAULT';
        break;
      case textsecure.protobuf.Verified.State.VERIFIED:
        state = 'VERIFIED';
        break;
      case textsecure.protobuf.Verified.State.UNVERIFIED:
        state = 'UNVERIFIED';
        break;
      default:
        console.log(`Got unexpected verified state: ${ev.verified.state}`);
    }

    console.log(
      'got verified sync for',
      number,
      state,
      ev.viaContactSync ? 'via contact sync' : ''
    );

    const contact = await ConversationController.getOrCreateAndWait(
      number,
      'private'
    );
    const options = {
      viaSyncMessage: true,
      viaContactSync: ev.viaContactSync,
      key,
    };

    if (state === 'VERIFIED') {
      await contact.setVerified(options);
    } else if (state === 'DEFAULT') {
      await contact.setVerifiedDefault(options);
    } else {
      await contact.setUnverified(options);
    }

    if (ev.confirm) {
      ev.confirm();
    }
  }

  function onDeliveryReceipt(ev) {
    const { deliveryReceipt } = ev;
    console.log(
      'delivery receipt from',
      `${deliveryReceipt.source}.${deliveryReceipt.sourceDevice}`,
      deliveryReceipt.timestamp
    );

    const receipt = Whisper.DeliveryReceipts.add({
      timestamp: deliveryReceipt.timestamp,
      source: deliveryReceipt.source,
    });

    ev.confirm();

    // Calling this directly so we can wait for completion
    return Whisper.DeliveryReceipts.onReceipt(receipt);
  }
})();
