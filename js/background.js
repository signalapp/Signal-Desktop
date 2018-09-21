/* global Backbone: false */
/* global $: false */

/* global dcodeIO: false */
/* global ConversationController: false */
/* global getAccountManager: false */
/* global Signal: false */
/* global storage: false */
/* global textsecure: false */
/* global Whisper: false */
/* global _: false */

// eslint-disable-next-line func-names
(async function() {
  'use strict';

  // Globally disable drag and drop
  document.body.addEventListener(
    'dragover',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );
  document.body.addEventListener(
    'drop',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );

  // Load these images now to ensure that they don't flicker on first use
  const images = [];
  function preload(list) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      images.push(image);
    }
  }
  preload([
    'alert-outline.svg',
    'android.svg',
    'apple.svg',
    'appstore.svg',
    'audio.svg',
    'back.svg',
    'chat-bubble-outline.svg',
    'chat-bubble.svg',
    'check-circle-outline.svg',
    'check.svg',
    'clock.svg',
    'close-circle.svg',
    'delete.svg',
    'dots-horizontal.svg',
    'double-check.svg',
    'down.svg',
    'download.svg',
    'ellipsis.svg',
    'error.svg',
    'error_red.svg',
    'file-gradient.svg',
    'file.svg',
    'folder-outline.svg',
    'forward.svg',
    'gear.svg',
    'group_default.png',
    'hourglass_empty.svg',
    'hourglass_full.svg',
    'icon_1024.png',
    'icon_128.png',
    'icon_16.png',
    'icon_250.png',
    'icon_256.png',
    'icon_32.png',
    'icon_48.png',
    'image.svg',
    'import.svg',
    'lead-pencil.svg',
    'menu.svg',
    'microphone.svg',
    'movie.svg',
    'open_link.svg',
    'paperclip.svg',
    'play.svg',
    'playstore.png',
    'read.svg',
    'reply.svg',
    'save.svg',
    'search.svg',
    'sending.svg',
    'shield.svg',
    'signal-laptop.png',
    'signal-phone.png',
    'smile.svg',
    'sync.svg',
    'timer-00.svg',
    'timer-05.svg',
    'timer-10.svg',
    'timer-15.svg',
    'timer-20.svg',
    'timer-25.svg',
    'timer-30.svg',
    'timer-35.svg',
    'timer-40.svg',
    'timer-45.svg',
    'timer-50.svg',
    'timer-55.svg',
    'timer-60.svg',
    'timer.svg',
    'verified-check.svg',
    'video.svg',
    'voice.svg',
    'warning.svg',
    'x.svg',
    'x_white.svg',
  ]);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const { Errors, Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    writeNewAttachmentData,
    deleteAttachmentData,
    getCurrentVersion,
  } = window.Signal.Migrations;
  const {
    Migrations0DatabaseWithAttachmentData,
    Migrations1DatabaseWithoutAttachmentData,
  } = window.Signal.Migrations;
  const { Views } = window.Signal;

  // Implicitly used in `indexeddb-backbonejs-adapter`:
  // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
  window.onInvalidStateError = error =>
    window.log.error(error && error.stack ? error.stack : error);

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());

  let idleDetector;
  let initialLoadComplete = false;
  let newVersion = false;

  window.owsDesktopApp = {};
  window.document.title = window.getTitle();

  // start a background worker for ecc
  textsecure.startWorker('js/libsignal-protocol-worker.js');
  Whisper.KeyChangeListener.init(textsecure.storage.protocol);
  textsecure.storage.protocol.on('removePreKey', () => {
    getAccountManager().refreshPreKeys();
  });

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
      accountManager = new textsecure.AccountManager(USERNAME, PASSWORD);
      accountManager.addEventListener('registration', () => {
        Whisper.Registration.markDone();
        window.log.info('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const cancelInitializationMessage = Views.Initialization.setMessage();
  window.log.info('Start IndexedDB migrations');

  window.log.info('Run migrations on database with attachment data');
  await Migrations0DatabaseWithAttachmentData.run({
    Backbone,
    logger: window.log,
  });

  const latestDBVersion2 = await getCurrentVersion();
  Whisper.Database.migrations[0].version = latestDBVersion2;

  window.log.info('Storage fetch');
  storage.fetch();

  function mapOldThemeToNew(theme) {
    switch (theme) {
      case 'dark':
      case 'light':
        return theme;
      case 'android-dark':
        return 'dark';
      case 'android':
      case 'ios':
      default:
        return 'light';
    }
  }

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => textsecure.storage.user.getDeviceName(),

      getThemeSetting: () => storage.get('theme-setting', 'light'),
      setThemeSetting: value => {
        storage.put('theme-setting', value);
        onChangeTheme();
      },
      getHideMenuBar: () => storage.get('hide-menu-bar'),
      setHideMenuBar: value => {
        storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },

      getNotificationSetting: () =>
        storage.get('notification-setting', 'message'),
      setNotificationSetting: value =>
        storage.put('notification-setting', value),
      getAudioNotification: () => storage.get('audio-notification'),
      setAudioNotification: value => storage.put('audio-notification', value),

      getSpellCheck: () => storage.get('spell-check', true),
      setSpellCheck: value => {
        storage.put('spell-check', value);
        startSpellCheck();
      },

      // eslint-disable-next-line eqeqeq
      isPrimary: () => textsecure.storage.user.getDeviceId() == '1',
      getSyncRequest: () =>
        new Promise((resolve, reject) => {
          const syncRequest = window.getSyncRequest();
          syncRequest.addEventListener('success', resolve);
          syncRequest.addEventListener('timeout', reject);
        }),
      getLastSyncTime: () => storage.get('synced_at'),
      setLastSyncTime: value => storage.put('synced_at', value),

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),
      deleteAllData: () => {
        const clearDataView = new window.Whisper.ClearDataView().render();
        $('body').append(clearDataView.el);
      },
    };

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    if (newVersion) {
      if (
        lastVersion &&
        window.isBeforeVersion(lastVersion, 'v1.15.0-beta.5')
      ) {
        await window.Signal.Logs.deleteAll();
        window.restart();
      }

      window.log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );
    }

    const MINIMUM_VERSION = 7;
    async function upgradeMessages() {
      const NUM_MESSAGES_PER_BATCH = 10;
      window.log.info(
        'upgradeMessages: Mandatory message schema upgrade started.',
        `Target version: ${MINIMUM_VERSION}`
      );

      let isMigrationWithoutIndexComplete = false;
      while (!isMigrationWithoutIndexComplete) {
        const database = Migrations0DatabaseWithAttachmentData.getDatabase();
        // eslint-disable-next-line no-await-in-loop
        const batchWithoutIndex = await MessageDataMigrator.processNextBatchWithoutIndex(
          {
            databaseName: database.name,
            minDatabaseVersion: database.version,
            numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
            upgradeMessageSchema,
            maxVersion: MINIMUM_VERSION,
            BackboneMessage: Whisper.Message,
            saveMessage: window.Signal.Data.saveLegacyMessage,
          }
        );
        window.log.info(
          'upgradeMessages: upgrade without index',
          batchWithoutIndex
        );
        isMigrationWithoutIndexComplete = batchWithoutIndex.done;
      }
      window.log.info('upgradeMessages: upgrade without index complete!');

      let isMigrationWithIndexComplete = false;
      while (!isMigrationWithIndexComplete) {
        // eslint-disable-next-line no-await-in-loop
        const batchWithIndex = await MessageDataMigrator.processNext({
          BackboneMessage: Whisper.Message,
          BackboneMessageCollection: Whisper.MessageCollection,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
          getMessagesNeedingUpgrade:
            window.Signal.Data.getLegacyMessagesNeedingUpgrade,
          saveMessage: window.Signal.Data.saveLegacyMessage,
          maxVersion: MINIMUM_VERSION,
        });
        window.log.info('upgradeMessages: upgrade with index', batchWithIndex);
        isMigrationWithIndexComplete = batchWithIndex.done;
      }
      window.log.info('upgradeMessages: upgrade with index complete!');

      window.log.info('upgradeMessages: Message schema upgrade complete');
    }

    await upgradeMessages();

    const db = await Whisper.Database.open();
    let totalMessages;
    try {
      totalMessages = await MessageDataMigrator.getNumMessages({
        connection: db,
      });
    } catch (error) {
      window.log.error(
        'background.getNumMessages error:',
        error && error.stack ? error.stack : error
      );
      totalMessages = 0;
    }

    function showMigrationStatus(current) {
      const status = `${current}/${totalMessages}`;
      Views.Initialization.setMessage(
        window.i18n('migratingToSQLCipher', [status])
      );
    }

    if (totalMessages) {
      window.log.info(`About to migrate ${totalMessages} messages`);
      showMigrationStatus(0);
    } else {
      window.log.info('About to migrate non-messages');
    }

    await window.Signal.migrateToSQL({
      db,
      clearStores: Whisper.Database.clearStores,
      handleDOMException: Whisper.Database.handleDOMException,
      arrayBufferToString: textsecure.MessageReceiver.arrayBufferToStringBase64,
      countCallback: count => {
        window.log.info(`Migration: ${count} messages complete`);
        showMigrationStatus(count);
      },
      writeNewAttachmentData,
    });

    db.close();

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    window.log.info('Running cleanup IndexedDB migrations...');
    await Whisper.Database.close();

    // Now we clean up IndexedDB database after extracting data from it
    await Migrations1DatabaseWithoutAttachmentData.run({
      Backbone,
      logger: window.log,
    });

    const latestDBVersion = _.last(
      Migrations1DatabaseWithoutAttachmentData.migrations
    ).version;
    Whisper.Database.migrations[0].version = latestDBVersion;

    window.log.info('Cleanup: starting...');
    const messagesForCleanup = await window.Signal.Data.getOutgoingWithoutExpiresAt(
      {
        MessageCollection: Whisper.MessageCollection,
      }
    );
    window.log.info(
      `Cleanup: Found ${messagesForCleanup.length} messages for cleanup`
    );
    await Promise.all(
      messagesForCleanup.map(async message => {
        const delivered = message.get('delivered');
        const sentAt = message.get('sent_at');
        const expirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );

        if (message.hasErrors()) {
          return;
        }

        if (delivered) {
          window.log.info(
            `Cleanup: Starting timer for delivered message ${sentAt}`
          );
          message.set(
            'expirationStartTimestamp',
            expirationStartTimestamp || sentAt
          );
          await message.setToExpire();
          return;
        }

        window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
        await window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
      })
    );
    window.log.info('Cleanup: complete');

    if (newVersion) {
      await window.Signal.Data.cleanupOrphanedAttachments();
    }

    Views.Initialization.setMessage(window.i18n('loading'));

    // Note: We are not invoking the second set of IndexedDB migrations because it is
    //   likely that any future migrations will simply extracting things from IndexedDB.

    idleDetector = new IdleDetector();
    let isMigrationWithIndexComplete = false;
    window.log.info(
      `Starting background data migration. Target version: ${
        Message.CURRENT_SCHEMA_VERSION
      }`
    );
    idleDetector.on('idle', async () => {
      const NUM_MESSAGES_PER_BATCH = 1;

      if (!isMigrationWithIndexComplete) {
        const batchWithIndex = await MessageDataMigrator.processNext({
          BackboneMessage: Whisper.Message,
          BackboneMessageCollection: Whisper.MessageCollection,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
          getMessagesNeedingUpgrade:
            window.Signal.Data.getMessagesNeedingUpgrade,
          saveMessage: window.Signal.Data.saveMessage,
        });
        window.log.info('Upgrade message schema (with index):', batchWithIndex);
        isMigrationWithIndexComplete = batchWithIndex.done;
      }

      if (isMigrationWithIndexComplete) {
        window.log.info(
          'Background migration complete. Stopping idle detector.'
        );
        idleDetector.stop();
      }
    });

    const startSpellCheck = () => {
      if (!window.enableSpellCheck || !window.disableSpellCheck) {
        return;
      }

      if (window.Events.getSpellCheck()) {
        window.enableSpellCheck();
      } else {
        window.disableSpellCheck();
      }
    };
    startSpellCheck();

    const themeSetting = window.Events.getThemeSetting();
    const newThemeSetting = mapOldThemeToNew(themeSetting);
    window.Events.setThemeSetting(newThemeSetting);

    try {
      await ConversationController.load();
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      start();
    }
  });

  Whisper.events.on('shutdown', async () => {
    if (idleDetector) {
      idleDetector.stop();
    }
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

  async function start() {
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', () => {
      window.log.info('handling registration event');
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
      window.log.info('Import was interrupted, showing import error screen');
      appView.openImporter();
    } else if (Whisper.Registration.everDone()) {
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.isImportMode()) {
      appView.openImporter();
    } else {
      appView.openInstaller();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
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
    window.log.info('offline');

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);
  }

  function onOnline() {
    window.log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
      window.log.warn('Already online. Had a blip in online/offline status.');
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
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      messageReceiver.close();
    }
  }

  let connectCount = 0;
  async function connect(firstRun) {
    window.log.info('connect');

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      window.log.warn(
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
    messageReceiver.addEventListener('reconnect', onReconnect);
    messageReceiver.addEventListener('progress', onProgress);
    messageReceiver.addEventListener('configuration', onConfiguration);

    window.textsecure.messaging = new textsecure.MessageSender(
      USERNAME,
      PASSWORD
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
    window.log.info('Sync read receipt configuration status:', status);

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
        window.log.info('sync successful');
        storage.put('synced_at', Date.now());
        Whisper.events.trigger('contactsync');
      });
      syncRequest.addEventListener('timeout', () => {
        window.log.error('sync timed out');
        Whisper.events.trigger('contactsync');
      });

      if (Whisper.Import.isComplete()) {
        textsecure.messaging
          .sendRequestConfigurationSyncMessage()
          .catch(error => {
            window.log.error(
              'Import complete, but failed to send sync message',
              error && error.stack ? error.stack : error
            );
          });
      }
    }

    storage.onready(async () => {
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
  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    Whisper.Notifications.disable();
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
    ev.confirm();
  }

  async function onContactReceived(ev) {
    const details = ev.contactDetails;

    const id = details.number;

    if (id === textsecure.storage.user.getNumber()) {
      // special case for syncing details about ourselves
      if (details.profileKey) {
        window.log.info('Got sync message with our own profile key');
        storage.put('profileKey', details.profileKey);
      }
    }

    const c = new Whisper.Conversation({
      id,
    });
    const validationError = c.validateNumber();
    if (validationError) {
      window.log.error(
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
        const profileKey = dcodeIO.ByteBuffer.wrap(details.profileKey).toString(
          'base64'
        );
        conversation.set({ profileKey });
      }

      if (typeof details.blocked !== 'undefined') {
        if (details.blocked) {
          storage.addBlockedNumber(id);
        } else {
          storage.removeBlockedNumber(id);
        }
      }

      conversation.set({
        name: details.name,
        color: details.color,
        active_at: activeAt,
      });

      // Update the conversation avatar only if new avatar exists and hash differs
      const { avatar } = details;
      if (avatar && avatar.data) {
        const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
          conversation.attributes,
          avatar.data,
          {
            writeNewAttachmentData,
            deleteAttachmentData,
          }
        );
        conversation.set(newAttributes);
      }

      await window.Signal.Data.updateConversation(id, conversation.attributes, {
        Conversation: Whisper.Conversation,
      });
      const { expireTimer } = details;
      const isValidExpireTimer = typeof expireTimer === 'number';
      if (isValidExpireTimer) {
        const source = textsecure.storage.user.getNumber();
        const receivedAt = Date.now();

        await conversation.updateExpirationTimer(
          expireTimer,
          source,
          receivedAt,
          { fromSync: true }
        );
      }

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
    } catch (error) {
      window.log.error('onContactReceived error:', Errors.toLogFormat(error));
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

    if (details.blocked) {
      storage.addBlockedGroup(id);
    } else {
      storage.removeBlockedGroup(id);
    }

    conversation.set(updates);

    // Update the conversation avatar only if new avatar exists and hash differs
    const { avatar } = details;
    if (avatar && avatar.data) {
      const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
        conversation.attributes,
        avatar.data,
        {
          writeNewAttachmentData,
          deleteAttachmentData,
        }
      );
      conversation.set(newAttributes);
    }

    await window.Signal.Data.updateConversation(id, conversation.attributes, {
      Conversation: Whisper.Conversation,
    });
    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (!isValidExpireTimer) {
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
        window.log.warn('Received duplicate message', message.idForLogging());
        return event.confirm();
      }

      const withQuoteReference = await copyFromQuotedMessage(data.message);
      const upgradedMessage = await upgradeMessageSchema(withQuoteReference);

      await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );
      return message.handleDataMessage(upgradedMessage, event.confirm, {
        initialLoadComplete,
      });
    };
  }

  async function copyFromQuotedMessage(message) {
    const { quote } = message;
    if (!quote) {
      return message;
    }

    const { attachments, id, author } = quote;
    const firstAttachment = attachments[0];

    const collection = await window.Signal.Data.getMessagesBySentAt(id, {
      MessageCollection: Whisper.MessageCollection,
    });
    const queryMessage = collection.find(item => {
      const messageAuthor = item.getContact();

      return messageAuthor && author === messageAuthor.id;
    });

    if (!queryMessage) {
      quote.referencedMessageNotFound = true;
      return message;
    }

    quote.text = queryMessage.get('body');
    if (firstAttachment) {
      firstAttachment.thumbnail = null;
    }

    if (
      !firstAttachment ||
      (!window.Signal.Util.GoogleChrome.isImageTypeSupported(
        firstAttachment.contentType
      ) &&
        !window.Signal.Util.GoogleChrome.isVideoTypeSupported(
          firstAttachment.contentType
        ))
    ) {
      return message;
    }

    try {
      if (queryMessage.get('schemaVersion') < Message.CURRENT_SCHEMA_VERSION) {
        const upgradedMessage = await upgradeMessageSchema(
          queryMessage.attributes
        );
        queryMessage.set(upgradedMessage);
        await window.Signal.Data.saveMessage(upgradedMessage, {
          Message: Whisper.Message,
        });
      }
    } catch (error) {
      window.log.error(
        'Problem upgrading message quoted message from database',
        Errors.toLogFormat(error)
      );
      return message;
    }

    const queryAttachments = queryMessage.get('attachments') || [];

    if (queryAttachments.length === 0) {
      return message;
    }

    const queryFirst = queryAttachments[0];
    const { thumbnail } = queryFirst;

    if (thumbnail && thumbnail.path) {
      firstAttachment.thumbnail = thumbnail;
    }

    return message;
  }

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    const profileKey = data.message.profileKey.toString('base64');
    const sender = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      'private'
    );

    // Will do the save for us
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
    const { id, type } = messageDescriptor;
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    conversation.set({ profileSharing: true });
    await window.Signal.Data.updateConversation(id, conversation.attributes, {
      Conversation: Whisper.Conversation,
    });

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
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || data.timestamp || Date.now(),
        Date.now()
      ),
    });
  }

  const onSentMessage = createMessageHandler({
    handleProfileUpdate: handleMessageSentProfileUpdate,
    getMessageDescriptor: getDescriptorForSent,
    createMessage: createSentMessage,
  });

  async function isMessageDuplicate(message) {
    try {
      const { attributes } = message;
      const result = await window.Signal.Data.getMessageBySender(attributes, {
        Message: Whisper.Message,
      });

      return Boolean(result);
    } catch (error) {
      window.log.error('isMessageDuplicate error:', Errors.toLogFormat(error));
      return false;
    }
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
    window.log.error('background onError:', Errors.toLogFormat(error));

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === 401 || error.code === 403)
    ) {
      Whisper.events.trigger('unauthorized');

      window.log.warn(
        'Client is no longer authorized; deleting local configuration'
      );
      Whisper.Registration.remove();

      const NUMBER_ID_KEY = 'number_id';
      const VERSION_KEY = 'version';
      const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
      const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

      const previousNumberId = textsecure.storage.get(NUMBER_ID_KEY);
      const lastProcessedIndex = textsecure.storage.get(
        LAST_PROCESSED_INDEX_KEY
      );
      const isMigrationComplete = textsecure.storage.get(
        IS_MIGRATION_COMPLETE_KEY
      );

      try {
        await textsecure.storage.protocol.removeAllConfiguration();

        // These two bits of data are important to ensure that the app loads up
        //   the conversation list, instead of showing just the QR code screen.
        Whisper.Registration.markEverDone();
        textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);

        // These two are important to ensure we don't rip through every message
        //   in the database attempting to upgrade it after starting up again.
        textsecure.storage.put(
          IS_MIGRATION_COMPLETE_KEY,
          isMigrationComplete || false
        );
        textsecure.storage.put(
          LAST_PROCESSED_INDEX_KEY,
          lastProcessedIndex || null
        );
        textsecure.storage.put(VERSION_KEY, window.getVersion());

        window.log.info('Successfully cleared local configuration');
      } catch (eraseError) {
        window.log.error(
          'Something went wrong clearing local configuration',
          eraseError && eraseError.stack ? eraseError.stack : eraseError
        );
      }

      return;
    }

    if (error && error.name === 'HTTPError' && error.code === -1) {
      // Failed to connect to server
      if (navigator.onLine) {
        window.log.info('retrying in 1 minute');
        setTimeout(connect, 60000);

        Whisper.events.trigger('reconnectTimer');
      }
      return;
    }

    if (ev.proto) {
      if (error && error.name === 'MessageCounterError') {
        if (ev.confirm) {
          ev.confirm();
        }
        // Ignore this message. It is likely a duplicate delivery
        // because the server lost our ack the first time.
        return;
      }
      const envelope = ev.proto;
      const message = initIncomingMessage(envelope);

      await message.saveErrors(error || new Error('Error was null'));
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

      await window.Signal.Data.updateConversation(id, conversation.attributes, {
        Conversation: Whisper.Conversation,
      });
    }

    throw error;
  }

  function onReadReceipt(ev) {
    const readAt = ev.timestamp;
    const { timestamp } = ev.read;
    const { reader } = ev.read;
    window.log.info('read receipt', reader, timestamp);

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
    window.log.info('read sync', sender, timestamp);

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
      window.log.error(
        'Invalid verified sync received:',
        Errors.toLogFormat(error)
      );
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
        window.log.error(`Got unexpected verified state: ${ev.verified.state}`);
    }

    window.log.info(
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
    window.log.info(
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
