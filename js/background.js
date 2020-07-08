/* global
  $,
  _,
  Backbone,
  ConversationController,
  getAccountManager,
  Signal,
  storage,
  textsecure,
  Whisper,
  libloki,
  libsession,
  libsignal,
  StringView,
  BlockedNumberController,
  libsession,
*/

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
    'crown.svg',
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
    'icon_16.png',
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
    'icon-paste.svg',
    'loki/session_icon_128.png',
  ]);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const {
    mandatoryMessageUpgrade,
    migrateAllToSQLCipher,
    removeDatabase,
    runMigrations,
    doesDatabaseExist,
  } = Signal.IndexedDB;
  const { Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    writeNewAttachmentData,
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
  Whisper.events.isListenedTo = eventName =>
    Whisper.events._events ? !!Whisper.events._events[eventName] : false;
  let accountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const USERNAME = storage.get('number_id');
      const PASSWORD = storage.get('password');
      accountManager = new textsecure.AccountManager(USERNAME, PASSWORD);
      accountManager.addEventListener('registration', () => {
        const user = {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
          isSecondaryDevice: !!textsecure.storage.get('isSecondaryDevice'),
        };
        Whisper.events.trigger('userChanged', user);

        Whisper.Registration.markDone();
        window.log.info('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const cancelInitializationMessage = Views.Initialization.setMessage();

  const isIndexedDBPresent = await doesDatabaseExist();
  if (isIndexedDBPresent) {
    window.installStorage(window.legacyStorage);
    window.log.info('Start IndexedDB migrations');
    await runMigrations();
  }

  window.log.info('Storage fetch');
  storage.fetch();

  let specialConvInited = false;
  const initSpecialConversations = async () => {
    if (specialConvInited) {
      return;
    }
    const rssFeedConversations = await window.Signal.Data.getAllRssFeedConversations(
      {
        ConversationCollection: Whisper.ConversationCollection,
      }
    );
    rssFeedConversations.forEach(conversation => {
      window.feeds.push(new window.LokiRssAPI(conversation.getRssSettings()));
    });
    const publicConversations = await window.Signal.Data.getAllPublicConversations(
      {
        ConversationCollection: Whisper.ConversationCollection,
      }
    );
    publicConversations.forEach(conversation => {
      // weird but create the object and does everything we need
      conversation.getPublicSendData();
    });
    specialConvInited = true;
  };

  const initAPIs = () => {
    if (window.initialisedAPI) {
      return;
    }
    const ourKey = textsecure.storage.user.getNumber();
    window.feeds = [];
    window.lokiMessageAPI = new window.LokiMessageAPI();
    // singleton to relay events to libtextsecure/message_receiver
    window.lokiPublicChatAPI = new window.LokiPublicChatAPI(ourKey);
    // singleton to interface the File server
    // If already exists we registered as a secondary device
    if (!window.lokiFileServerAPI) {
      window.lokiFileServerAPIFactory = new window.LokiFileServerAPI(ourKey);
      window.lokiFileServerAPI = window.lokiFileServerAPIFactory.establishHomeConnection(
        window.getDefaultFileServer()
      );
    }

    window.initialisedAPI = true;

    if (storage.get('isSecondaryDevice')) {
      window.lokiFileServerAPI.updateOurDeviceMapping();
    }
  };

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

    // Update zoom
    window.updateZoomFactor();

    if (
      window.lokiFeatureFlags.useOnionRequests ||
      window.lokiFeatureFlags.useFileOnionRequests
    ) {
      // Initialize paths for onion requests
      window.OnionAPI.buildNewOnionPaths();
    }

    const currentPoWDifficulty = storage.get('PoWDifficulty', null);
    if (!currentPoWDifficulty) {
      storage.put('PoWDifficulty', window.getDefaultPoWDifficulty());
    }

    // Ensure accounts created prior to 1.0.0-beta8 do have their
    // 'primaryDevicePubKey' defined.
    if (
      Whisper.Registration.isDone() &&
      !storage.get('primaryDevicePubKey', null)
    ) {
      storage.put('primaryDevicePubKey', textsecure.storage.user.getNumber());
    }

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getThemeSetting: () => 'dark', // storage.get('theme-setting', 'dark')
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

      getSpellCheck: () => storage.get('spell-check', true),
      setSpellCheck: value => {
        storage.put('spell-check', value);
      },

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),

      shutdown: async () => {
        // Stop background processing
        window.Signal.AttachmentDownloads.stop();
        if (idleDetector) {
          idleDetector.stop();
        }

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          messageReceiver = null;
        }

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },
    };

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    if (newVersion) {
      window.log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      await window.Signal.Data.cleanupOrphanedAttachments();

      await window.Signal.Logs.deleteAll();
    }

    if (isIndexedDBPresent) {
      await mandatoryMessageUpgrade({ upgradeMessageSchema });
      await migrateAllToSQLCipher({ writeNewAttachmentData, Views });
      await removeDatabase();
      try {
        await window.Signal.Data.removeIndexedDBFiles();
      } catch (error) {
        window.log.error(
          'Failed to remove IndexedDB files:',
          error && error.stack ? error.stack : error
        );
      }

      window.installStorage(window.newStorage);
      await window.storage.fetch();
      await storage.put('indexeddb-delete-needed', true);
    }

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    Views.Initialization.setMessage(window.i18n('loading'));

    idleDetector = new IdleDetector();
    let isMigrationWithIndexComplete = false;
    window.log.info(
      `Starting background data migration. Target version: ${Message.CURRENT_SCHEMA_VERSION}`
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

    const themeSetting = window.Events.getThemeSetting();
    const newThemeSetting = mapOldThemeToNew(themeSetting);
    window.Events.setThemeSetting(newThemeSetting);

    try {
      await Promise.all([
        ConversationController.load(),
        textsecure.storage.protocol.hydrateCaches(),
        BlockedNumberController.load(),
      ]);
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      start();
    }
  });

  Whisper.events.on('setupWithImport', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openImporter();
    }
  });

  Whisper.events.on(
    'deleteLocalPublicMessages',
    async ({ messageServerIds, conversationId }) => {
      if (!Array.isArray(messageServerIds)) {
        return;
      }
      const messageIds = await window.Signal.Data.getMessageIdsFromServerIds(
        messageServerIds,
        conversationId
      );
      if (messageIds.length === 0) {
        return;
      }

      const conversation = ConversationController.get(conversationId);
      messageIds.forEach(id => {
        if (conversation) {
          conversation.removeMessage(id);
        }
        window.Signal.Data.removeMessage(id, {
          Message: Whisper.Message,
        });
      });
    }
  );

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

  function manageExpiringData() {
    window.Signal.Data.cleanSeenMessages();
    window.Signal.Data.cleanLastHashes();
    setTimeout(manageExpiringData, 1000 * 60 * 60);
  }

  async function start() {
    manageExpiringData();
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');
    const results = await Promise.all([
      window.Signal.Data.getOutgoingWithoutExpiresAt({
        MessageCollection: Whisper.MessageCollection,
      }),
    ]);

    // Combine the models
    const messagesForCleanup = results.reduce(
      (array, current) => array.concat(current.toArray()),
      []
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

        if (message.isEndSession()) {
          return;
        }

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
        const conversation = message.getConversation();
        if (conversation) {
          await conversation.updateLastMessage();
        }
      })
    );
    window.log.info('Cleanup: complete');

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', async () => {
      window.log.info('handling registration event');

      // Disable link previews as default per Kee
      storage.onready(async () => {
        storage.put('link-preview-setting', false);
      });

      // listeners
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
    } else if (
      Whisper.Registration.isDone() &&
      !Whisper.Registration.ongoingSecondaryDeviceRegistration()
    ) {
      // listeners
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);

      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.isImportMode()) {
      appView.openImporter();
    } else {
      appView.openStandalone();
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

    Whisper.events.on('showConversation', (id, messageId) => {
      if (appView) {
        appView.openConversation(id, messageId);
      }
    });

    window.doUpdateGroup = async (groupId, groupName, members, avatar) => {
      const ourKey = textsecure.storage.user.getNumber();

      const convo = await ConversationController.getOrCreateAndWait(
        groupId,
        'group'
      );

      const ev = {
        groupDetails: {
          id: groupId,
          name: groupName,
          members,
          active: true,
          expireTimer: convo.get('expireTimer'),
          avatar,
          is_medium_group: false,
        },
        confirm: () => {},
      };

      const recipients = _.union(convo.get('members'), members);

      await window.NewReceiver.onGroupReceived(ev);

      if (convo.isPublic()) {
        const API = await convo.getPublicSendData();

        if (avatar) {
          // I hate duplicating this...
          const readFile = attachment =>
            new Promise((resolve, reject) => {
              const fileReader = new FileReader();
              fileReader.onload = e => {
                const data = e.target.result;
                resolve({
                  ...attachment,
                  data,
                  size: data.byteLength,
                });
              };
              fileReader.onerror = reject;
              fileReader.onabort = reject;
              fileReader.readAsArrayBuffer(attachment.file);
            });
          const attachment = await readFile({ file: avatar });
          // const tempUrl = window.URL.createObjectURL(avatar);

          // Get file onto public chat server
          const fileObj = await API.serverAPI.putAttachment(attachment.data);
          if (fileObj === null) {
            // problem
            window.warn('File upload failed');
            return;
          }

          // lets not allow ANY URLs, lets force it to be local to public chat server
          const url = new URL(fileObj.url);

          // write it to the channel
          await API.setChannelAvatar(url.pathname);
        }

        if (await API.setChannelName(groupName)) {
          // queue update from server
          // and let that set the conversation
          API.pollForChannelOnce();
          // or we could just directly call
          // convo.setGroupName(groupName);
          // but gut is saying let the server be the definitive storage of the state
          // and trickle down from there
        }
        return;
      }

      const nullAvatar = '';
      if (avatar) {
        // would get to download this file on each client in the group
        // and reference the local file
      }
      const options = {};

      const isMediumGroup = convo.isMediumGroup();

      const updateObj = {
        id: groupId,
        name: groupName,
        avatar: nullAvatar,
        recipients,
        members,
        is_medium_group: isMediumGroup,
        options,
      };

      // Send own sender keys and group secret key
      if (isMediumGroup) {
        const { chainKey, keyIdx } = await window.SenderKeyAPI.getSenderKeys(
          groupId,
          ourKey
        );

        updateObj.senderKey = {
          chainKey: StringView.arrayBufferToHex(chainKey),
          keyIdx,
        };

        const groupIdentity = await window.Signal.Data.getIdentityKeyById(
          groupId
        );

        const secretKeyHex = StringView.hexToArrayBuffer(
          groupIdentity.secretKey
        );

        updateObj.secretKey = secretKeyHex;
      }

      convo.updateGroup(updateObj);
    };

    window.createMediumSizeGroup = async (groupName, members) => {
      // Create Group Identity
      const identityKeys = await libsignal.KeyHelper.generateIdentityKeyPair();
      const groupId = StringView.arrayBufferToHex(identityKeys.pubKey);

      const ourIdentity = await textsecure.storage.user.getNumber();

      const senderKey = await window.SenderKeyAPI.createSenderKeyForGroup(
        groupId,
        ourIdentity
      );

      const groupSecretKeyHex = StringView.arrayBufferToHex(
        identityKeys.privKey
      );

      const primary = window.storage.get('primaryDevicePubKey');

      const allMembers = [primary, ...members];

      await window.Signal.Data.createOrUpdateIdentityKey({
        id: groupId,
        secretKey: groupSecretKeyHex,
      });

      const ev = {
        groupDetails: {
          id: groupId,
          name: groupName,
          members: allMembers,
          recipients: allMembers,
          active: true,
          expireTimer: 0,
          avatar: '',
          secretKey: identityKeys.privKey,
          senderKey,
          is_medium_group: true,
        },
        confirm: () => {},
      };

      await window.NewReceiver.onGroupReceived(ev);

      const convo = await ConversationController.getOrCreateAndWait(
        groupId,
        'group'
      );

      convo.updateGroupAdmins([primary]);
      convo.updateGroup(ev.groupDetails);

      appView.openConversation(groupId, {});

      // Subscribe to this group id
      window.SwarmPolling.addGroupId(new libsession.Types.PubKey(groupId));
    };

    window.doCreateGroup = async (groupName, members) => {
      const keypair = await libsignal.KeyHelper.generateIdentityKeyPair();
      const groupId = StringView.arrayBufferToHex(keypair.pubKey);

      const primaryDeviceKey =
        window.storage.get('primaryDevicePubKey') ||
        textsecure.storage.user.getNumber();
      const allMembers = [primaryDeviceKey, ...members];

      const ev = {
        groupDetails: {
          id: groupId,
          name: groupName,
          members: allMembers,
          recipients: allMembers,
          active: true,
          expireTimer: 0,
          avatar: '',
        },
        confirm: () => {},
      };

      await window.NewReceiver.onGroupReceived(ev);

      const convo = await ConversationController.getOrCreateAndWait(
        groupId,
        'group'
      );

      convo.updateGroupAdmins([primaryDeviceKey]);
      convo.updateGroup(ev.groupDetails);

      textsecure.messaging.sendGroupSyncMessage([convo]);
      appView.openConversation(groupId, {});
    };

    window.confirmationDialog = params => {
      const confirmDialog = new Whisper.SessionConfirmView({
        el: $('body'),
        title: params.title,
        message: params.message,
        messageSub: params.messageSub || undefined,
        resolve: params.resolve || undefined,
        reject: params.reject || undefined,
        okText: params.okText || undefined,
        okTheme: params.okTheme || undefined,
        closeTheme: params.closeTheme || undefined,
        cancelText: params.cancelText || undefined,
        hideCancel: params.hideCancel || false,
      });

      confirmDialog.render();
    };

    window.showQRDialog = window.owsDesktopApp.appView.showQRDialog;
    window.showSeedDialog = window.owsDesktopApp.appView.showSeedDialog;
    window.showPasswordDialog = window.owsDesktopApp.appView.showPasswordDialog;
    window.showEditProfileDialog = async callback => {
      const ourNumber = window.storage.get('primaryDevicePubKey');
      const conversation = await ConversationController.getOrCreateAndWait(
        ourNumber,
        'private'
      );

      const readFile = attachment =>
        new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.onload = e => {
            const data = e.target.result;
            resolve({
              ...attachment,
              data,
              size: data.byteLength,
            });
          };
          fileReader.onerror = reject;
          fileReader.onabort = reject;
          fileReader.readAsArrayBuffer(attachment.file);
        });

      const avatarPath = conversation.getAvatarPath();
      const profile = conversation.getLokiProfile();
      const displayName = profile && profile.displayName;

      if (appView) {
        appView.showEditProfileDialog({
          callback,
          profileName: displayName,
          pubkey: ourNumber,
          avatarPath,
          avatarColor: conversation.getColor(),
          onOk: async (newName, avatar) => {
            let newAvatarPath = '';
            let url = null;
            let profileKey = null;
            if (avatar) {
              const data = await readFile({ file: avatar });

              // For simplicity we use the same attachment pointer that would send to
              // others, which means we need to wait for the database response.
              // To avoid the wait, we create a temporary url for the local image
              // and use it until we the the response from the server
              const tempUrl = window.URL.createObjectURL(avatar);
              conversation.setLokiProfile({ displayName: newName });
              conversation.set('avatar', tempUrl);

              // Encrypt with a new key every time
              profileKey = libsignal.crypto.getRandomBytes(32);
              const encryptedData = await textsecure.crypto.encryptProfile(
                data.data,
                profileKey
              );

              const avatarPointer = await libsession.Utils.AttachmentUtils.uploadAvatar(
                {
                  ...data,
                  data: encryptedData,
                  size: encryptedData.byteLength,
                }
              );

              ({ url } = avatarPointer);

              storage.put('profileKey', profileKey);

              conversation.set('avatarPointer', url);

              const upgraded = await Signal.Migrations.processNewAttachment({
                isRaw: true,
                data: data.data,
                url,
              });
              newAvatarPath = upgraded.path;
            }

            // Replace our temporary image with the attachment pointer from the server:
            conversation.set('avatar', null);
            conversation.setLokiProfile({
              displayName: newName,
              avatar: newAvatarPath,
            });
            // inform all your registered public servers
            // could put load on all the servers
            // if they just keep changing their names without sending messages
            // so we could disable this here
            // or least it enable for the quickest response
            window.lokiPublicChatAPI.setProfileName(newName);
            window
              .getConversations()
              .filter(convo => convo.isPublic() && !convo.isRss())
              .forEach(convo =>
                convo.trigger('ourAvatarChanged', { url, profileKey })
              );
          },
        });
      }
    };

    // Set user's launch count.
    const prevLaunchCount = window.getSettingValue('launch-count');
    const launchCount = !prevLaunchCount ? 1 : prevLaunchCount + 1;
    window.setSettingValue('launch-count', launchCount);

    // On first launch
    if (launchCount === 1) {
      // Initialise default settings
      window.setSettingValue('hide-menu-bar', true);
      window.setSettingValue('link-preview-setting', false);
    }

    // Generates useful random ID for various purposes
    window.generateID = () =>
      Math.random()
        .toString(36)
        .substring(3);

    window.toasts = new Map();
    window.pushToast = options => {
      // Setting toasts with the same ID can be used to prevent identical
      // toasts from appearing at once (stacking).
      // If toast already exists, it will be reloaded (updated)

      const params = {
        title: options.title,
        id: options.id || window.generateID(),
        description: options.description || '',
        type: options.type || '',
        icon: options.icon || '',
        shouldFade: options.shouldFade,
      };

      // Give all toasts an ID. User may define.
      let currentToast;
      const toastID = params.id;
      const toast = !!toastID && window.toasts.get(toastID);
      if (toast) {
        currentToast = window.toasts.get(toastID);
        currentToast.update(params);
      } else {
        // Make new Toast
        window.toasts.set(
          toastID,
          new Whisper.SessionToastView({
            el: $('body'),
          })
        );

        currentToast = window.toasts.get(toastID);
        currentToast.render();
        currentToast.update(params);
      }

      // Remove some toasts if too many exist
      const maxToasts = 6;
      while (window.toasts.size > maxToasts) {
        const finalToastID = window.toasts.keys().next().value;
        window.toasts.get(finalToastID).fadeToast();
      }

      return toastID;
    };

    // Get memberlist. This function is not accurate >>
    // window.getMemberList = window.lokiPublicChatAPI.getListOfMembers();

    window.deleteAccount = async () => {
      try {
        window.log.info('Deleting everything!');

        const { Logs } = window.Signal;
        await Logs.deleteAll();

        await window.Signal.Data.removeAll();
        await window.Signal.Data.close();
        await window.Signal.Data.removeDB();

        await window.Signal.Data.removeOtherData();
      } catch (error) {
        window.log.error(
          'Something went wrong deleting all data:',
          error && error.stack ? error.stack : error
        );
      }
      window.restart();
    };

    window.toggleTheme = () => {
      const theme = window.Events.getThemeSetting();
      const updatedTheme = theme === 'dark' ? 'light' : 'dark';

      $(document.body)
        .removeClass('dark-theme')
        .removeClass('light-theme')
        .addClass(`${updatedTheme}-theme`);
      window.Events.setThemeSetting(updatedTheme);
    };

    window.toggleMenuBar = () => {
      const current = window.getSettingValue('hide-menu-bar');
      if (current === undefined) {
        window.Events.setHideMenuBar(false);
        return;
      }

      window.Events.setHideMenuBar(!current);
    };

    window.toggleSpellCheck = () => {
      const currentValue = window.getSettingValue('spell-check');
      // if undefined, it means 'default' so true. but we have to toggle it, so false
      // if not undefined, we take the opposite
      const newValue = currentValue !== undefined ? !currentValue : false;
      window.Events.setSpellCheck(newValue);
      window.pushToast({
        description: window.i18n('spellCheckDirty'),
        type: 'info',
        id: 'spellCheckDirty',
      });
    };

    window.toggleLinkPreview = () => {
      const newValue = !window.getSettingValue('link-preview-setting');
      window.setSettingValue('link-preview-setting', newValue);
    };

    window.toggleMediaPermissions = () => {
      const mediaPermissions = window.getMediaPermissions();
      window.setMediaPermissions(!mediaPermissions);
    };

    // Attempts a connection to an open group server
    window.attemptConnection = async (serverURL, channelId) => {
      let rawserverURL = serverURL
        .replace(/^https?:\/\//i, '')
        .replace(/[/\\]+$/i, '');
      rawserverURL = rawserverURL.toLowerCase();
      const sslServerURL = `https://${rawserverURL}`;
      const conversationId = `publicChat:${channelId}@${rawserverURL}`;

      // Quickly peak to make sure we don't already have it
      const conversationExists = window.ConversationController.get(
        conversationId
      );
      if (conversationExists) {
        // We are already a member of this public chat
        return new Promise((_resolve, reject) => {
          reject(window.i18n('publicChatExists'));
        });
      }

      // Get server
      const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(
        sslServerURL
      );
      // SSL certificate failure or offline
      if (!serverAPI) {
        // Url incorrect or server not compatible
        return new Promise((_resolve, reject) => {
          reject(window.i18n('connectToServerFail'));
        });
      }

      // Create conversation
      const conversation = await window.ConversationController.getOrCreateAndWait(
        conversationId,
        'group'
      );

      // Convert conversation to a public one
      await conversation.setPublicSource(sslServerURL, channelId);

      // and finally activate it
      conversation.getPublicSendData(); // may want "await" if you want to use the API

      return conversation;
    };

    window.sendGroupInvitations = (serverInfo, pubkeys) => {
      pubkeys.forEach(async pubkeyStr => {
        const convo = await ConversationController.getOrCreateAndWait(
          pubkeyStr,
          'private'
        );

        if (convo) {
          convo.sendMessage('', null, null, null, {
            serverName: serverInfo.name,
            channelId: serverInfo.channelId,
            serverAddress: serverInfo.address,
          });
        }
      });
    };

    Whisper.events.on('updateGroupName', async groupConvo => {
      if (appView) {
        appView.showUpdateGroupNameDialog(groupConvo);
      }
    });
    Whisper.events.on('updateGroupMembers', async groupConvo => {
      if (appView) {
        appView.showUpdateGroupMembersDialog(groupConvo);
      }
    });

    Whisper.events.on('inviteContacts', async groupConvo => {
      if (appView) {
        appView.showInviteContactsDialog(groupConvo);
      }
    });

    Whisper.events.on('addModerators', async groupConvo => {
      if (appView) {
        appView.showAddModeratorsDialog(groupConvo);
      }
    });

    Whisper.events.on('removeModerators', async groupConvo => {
      if (appView) {
        appView.showRemoveModeratorsDialog(groupConvo);
      }
    });

    Whisper.events.on(
      'publicChatInvitationAccepted',
      async (serverAddress, channelId) => {
        // To some degree this has been copy-pasted
        // form connection_to_server_dialog_view.js:
        const rawServerUrl = serverAddress
          .replace(/^https?:\/\//i, '')
          .replace(/[/\\]+$/i, '');
        const sslServerUrl = `https://${rawServerUrl}`;
        const conversationId = `publicChat:${channelId}@${rawServerUrl}`;

        const conversationExists = ConversationController.get(conversationId);
        if (conversationExists) {
          window.log.warn('We are already a member of this public chat');
          window.pushToast({
            description: window.i18n('publicChatExists'),
            type: 'info',
            id: 'alreadyMemberPublicChat',
          });
          return;
        }

        const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(
          sslServerUrl
        );
        if (!serverAPI) {
          window.log.warn(`Could not connect to ${serverAddress}`);
          return;
        }

        const conversation = await ConversationController.getOrCreateAndWait(
          conversationId,
          'group'
        );

        serverAPI.findOrCreateChannel(channelId, conversationId);
        await conversation.setPublicSource(sslServerUrl, channelId);

        appView.openConversation(conversationId, {});
      }
    );

    Whisper.events.on('leaveGroup', async groupConvo => {
      if (appView) {
        appView.showLeaveGroupDialog(groupConvo);
      }
    });

    Whisper.events.on('deleteConversation', async conversation => {
      await conversation.destroyMessages();
      await window.Signal.Data.removeConversation(conversation.id, {
        Conversation: Whisper.Conversation,
      });
    });

    Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        appView.openConversation(id, messageId);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });

    Whisper.events.on('openInbox', () => {
      appView.openInbox({
        initialLoadComplete,
      });
    });

    Whisper.events.on('onShowUserDetails', async ({ userPubKey }) => {
      const isMe = userPubKey === textsecure.storage.user.getNumber();

      if (isMe) {
        Whisper.events.trigger('onEditProfile');
        return;
      }

      const conversation = await ConversationController.getOrCreateAndWait(
        userPubKey,
        'private'
      );

      const avatarPath = conversation.getAvatarPath();
      const profile = conversation.getLokiProfile();
      const displayName = profile && profile.displayName;

      if (appView) {
        appView.showUserDetailsDialog({
          profileName: displayName,
          pubkey: userPubKey,
          avatarPath,
          avatarColor: conversation.getColor(),
          isRss: conversation.isRss(),
          onStartConversation: () => {
            Whisper.events.trigger('showConversation', userPubKey);
          },
        });
      }
    });

    Whisper.events.on('showToast', options => {
      if (
        appView &&
        appView.inboxView &&
        appView.inboxView.conversation_stack
      ) {
        appView.inboxView.conversation_stack.showToast(options);
      }
    });

    Whisper.events.on('showConfirmationDialog', options => {
      if (
        appView &&
        appView.inboxView &&
        appView.inboxView.conversation_stack
      ) {
        appView.inboxView.conversation_stack.showConfirmationDialog(options);
      }
    });

    Whisper.events.on('showSessionRestoreConfirmation', options => {
      if (appView) {
        appView.showSessionRestoreConfirmation(options);
      }
    });

    Whisper.events.on('showNicknameDialog', options => {
      if (appView) {
        appView.showNicknameDialog(options);
      }
    });

    Whisper.events.on('showSeedDialog', async () => {
      if (appView) {
        appView.showSeedDialog();
      }
    });

    Whisper.events.on('showQRDialog', async () => {
      if (appView) {
        const ourNumber = textsecure.storage.user.getNumber();
        appView.showQRDialog(ourNumber);
      }
    });

    Whisper.events.on('showDevicePairingDialog', async (options = {}) => {
      if (appView) {
        appView.showDevicePairingDialog(options);
      }
    });

    Whisper.events.on('showDevicePairingWordsDialog', async () => {
      if (appView) {
        appView.showDevicePairingWordsDialog();
      }
    });

    Whisper.events.on('calculatingPoW', ({ pubKey, timestamp }) => {
      try {
        const conversation = ConversationController.get(pubKey);
        conversation.onCalculatingPoW(pubKey, timestamp);
      } catch (e) {
        window.log.error('Error showing PoW cog');
      }
    });

    Whisper.events.on(
      'publicMessageSent',
      ({ pubKey, timestamp, serverId }) => {
        try {
          const conversation = ConversationController.get(pubKey);
          conversation.onPublicMessageSent(pubKey, timestamp, serverId);
        } catch (e) {
          window.log.error('Error setting public on message');
        }
      }
    );

    Whisper.events.on('password-updated', () => {
      if (appView && appView.inboxView) {
        appView.inboxView.trigger('password-updated');
      }
    });

    Whisper.events.on('devicePairingRequestReceivedNoListener', async () => {
      // If linking limit has been reached, let master know.
      const ourKey = textsecure.storage.user.getNumber();
      const ourPubKey = window.libsession.Types.PubKey.cast(ourKey);
      const authorisations = await window.libsession.Protocols.MultiDeviceProtocol.fetchPairingAuthorisations(
        ourPubKey
      );

      const title = authorisations.length
        ? window.i18n('devicePairingRequestReceivedLimitTitle')
        : window.i18n('devicePairingRequestReceivedNoListenerTitle');

      const description = authorisations.length
        ? window.i18n(
            'devicePairingRequestReceivedLimitDescription',
            window.CONSTANTS.MAX_LINKED_DEVICES
          )
        : window.i18n('devicePairingRequestReceivedNoListenerDescription');

      const type = authorisations.length ? 'info' : 'warning';

      window.pushToast({
        title,
        description,
        type,
        id: 'pairingRequestReceived',
        shouldFade: false,
      });
    });

    Whisper.events.on('devicePairingRequestAccepted', async (pubKey, cb) => {
      try {
        await getAccountManager().authoriseSecondaryDevice(pubKey);
        cb(null);
      } catch (e) {
        cb(e);
      }
    });

    Whisper.events.on('devicePairingRequestRejected', async pubKey => {
      await libloki.storage.removeContactPreKeyBundle(pubKey);
      await libsession.Protocols.MultiDeviceProtocol.removePairingAuthorisations(
        pubKey
      );
    });

    Whisper.events.on('deviceUnpairingRequested', async (pubKey, callback) => {
      const isSecondaryDevice = !!textsecure.storage.get('isSecondaryDevice');
      if (isSecondaryDevice) {
        return;
      }
      await libsession.Protocols.MultiDeviceProtocol.removePairingAuthorisations(
        pubKey
      );
      await window.lokiFileServerAPI.updateOurDeviceMapping();
      // TODO: we should ensure the message was sent and retry automatically if not
      const device = new libsession.Types.PubKey(pubKey);
      const unlinkMessage = new libsession.Messages.Outgoing.DeviceUnlinkMessage(
        pubKey
      );

      await libsession.getMessageQueue().send(device, unlinkMessage);
      // Remove all traces of the device
      setTimeout(() => {
        ConversationController.deleteContact(pubKey);
        Whisper.events.trigger('refreshLinkedDeviceList');
        callback();
      }, 1000);
    });
  }

  window.getSyncRequest = () =>
    new textsecure.SyncRequest(textsecure.messaging, messageReceiver);

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

  async function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      await messageReceiver.close();
    }
    window.Signal.AttachmentDownloads.stop();
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
      await messageReceiver.close();
    }

    const USERNAME = storage.get('number_id');
    const PASSWORD = storage.get('password');
    const mySignalingKey = storage.get('signaling_key');

    connectCount += 1;
    const options = {
      retryCached: connectCount === 1,
      serverTrustRoot: window.getServerTrustRoot(),
    };

    Whisper.Notifications.disable(); // avoid notification flood until empty
    setTimeout(() => {
      Whisper.Notifications.enable();
    }, window.CONSTANTS.NOTIFICATION_ENABLE_TIMEOUT_SECONDS * 1000);

    // TODO: Investigate the case where we reconnect
    const ourKey = textsecure.storage.user.getNumber();
    window.SwarmPolling.addPubkey(ourKey);
    window.SwarmPolling.start();

    window.NewReceiver.queueAllCached();

    if (Whisper.Registration.ongoingSecondaryDeviceRegistration()) {
      window.lokiMessageAPI = new window.LokiMessageAPI();
      window.lokiFileServerAPIFactory = new window.LokiFileServerAPI(ourKey);
      window.lokiFileServerAPI = window.lokiFileServerAPIFactory.establishHomeConnection(
        window.getDefaultFileServer()
      );
      window.lokiPublicChatAPI = null;
      window.feeds = [];
      messageReceiver = new textsecure.MessageReceiver(
        USERNAME,
        PASSWORD,
        mySignalingKey,
        options
      );
      messageReceiver.addEventListener(
        'message',
        window.NewReceiver.handleMessageEvent
      );
      window.textsecure.messaging = new textsecure.MessageSender(
        USERNAME,
        PASSWORD
      );
      return;
    }

    initAPIs();
    await initSpecialConversations();
    messageReceiver = new textsecure.MessageReceiver(
      USERNAME,
      PASSWORD,
      mySignalingKey,
      options
    );
    messageReceiver.addEventListener(
      'message',
      window.NewReceiver.handleMessageEvent
    );
    messageReceiver.addEventListener(
      'group',
      window.NewReceiver.onGroupReceived
    );
    messageReceiver.addEventListener(
      'sent',
      window.NewReceiver.handleMessageEvent
    );
    messageReceiver.addEventListener('empty', onEmpty);
    messageReceiver.addEventListener('reconnect', onReconnect);
    messageReceiver.addEventListener('progress', onProgress);
    messageReceiver.addEventListener('configuration', onConfiguration);
    // messageReceiver.addEventListener('typing', onTyping);

    window.Signal.AttachmentDownloads.start({
      logger: window.log,
    });

    window.textsecure.messaging = new textsecure.MessageSender(
      USERNAME,
      PASSWORD
    );

    // On startup after upgrading to a new version, request a contact sync
    //   (but only if we're not the primary device)
    if (
      !firstRun &&
      connectCount === 1 &&
      newVersion &&
      // eslint-disable-next-line eqeqeq
      textsecure.storage.user.getDeviceId() != '1'
    ) {
      window.getSyncRequest();
    }

    const deviceId = textsecure.storage.user.getDeviceId();
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
        const { CONFIGURATION } = textsecure.protobuf.SyncMessage.Request.Type;
        const { RequestSyncMessage } = window.libsession.Messages.Outgoing;

        const requestConfigurationSyncMessage = new RequestSyncMessage({
          timestamp: Date.now(),
          reqestType: CONFIGURATION,
        });
        await libsession
          .getMessageQueue()
          .sendSyncMessage(requestConfigurationSyncMessage);
        // sending of the message is handled in the 'private' case below
      }
    }

    libsession.Protocols.SessionProtocol.checkSessionRequestExpiry().catch(
      e => {
        window.log.error(
          'Error occured which checking for session request expiry',
          e
        );
      }
    );

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

    window.readyForUpdates();

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

    // Enable back notifications once most messages have been fetched
    setTimeout(() => {
      Whisper.Notifications.enable();
    }, window.CONSTANTS.NOTIFICATION_ENABLE_TIMEOUT_SECONDS * 1000);
  }
  function onProgress(ev) {
    const { count } = ev;
    window.log.info(`onProgress: Message count is ${count}`);

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(count);
    }
  }
  function onConfiguration(ev) {
    const { configuration } = ev;
    const {
      readReceipts,
      typingIndicators,
      unidentifiedDeliveryIndicators,
      linkPreviews,
    } = configuration;

    storage.put('read-receipt-setting', readReceipts);

    if (
      unidentifiedDeliveryIndicators === true ||
      unidentifiedDeliveryIndicators === false
    ) {
      storage.put(
        'unidentifiedDeliveryIndicators',
        unidentifiedDeliveryIndicators
      );
    }

    if (typingIndicators === true || typingIndicators === false) {
      storage.put('typing-indicators-setting', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      storage.put('link-preview-setting', linkPreviews);
    }

    ev.confirm();
  }
})();
