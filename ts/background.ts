// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataMessageClass } from './textsecure.d';
import { MessageAttributesType } from './model-types.d';
import { WhatIsThis } from './window.d';
import { getTitleBarVisibility, TitleBarVisibility } from './types/Settings';
import { isWindowDragElement } from './util/isWindowDragElement';
import { assert } from './util/assert';
import * as refreshSenderCertificate from './refreshSenderCertificate';
import { SenderCertificateMode } from './metadata/SecretSessionCipher';
import { routineProfileRefresh } from './routineProfileRefresh';
import { isMoreRecentThan, isOlderThan } from './util/timestamp';

const MAX_ATTACHMENT_DOWNLOAD_AGE = 3600 * 72 * 1000;

export async function startApp(): Promise<void> {
  window.startupProcessingQueue = new window.Signal.Util.StartupQueue();
  window.attachmentDownloadQueue = [];
  try {
    window.log.info('Initializing SQL in renderer');
    await window.sqlInitializer.initialize();
    window.log.info('SQL initialized in renderer');
  } catch (err) {
    window.log.error(
      'SQL failed to initialize',
      err && err.stack ? err.stack : err
    );
  }
  const eventHandlerQueue = new window.PQueue({
    concurrency: 1,
    timeout: 1000 * 60 * 2,
  });
  window.Whisper.deliveryReceiptQueue = new window.PQueue({
    concurrency: 1,
    timeout: 1000 * 60 * 2,
  });
  window.Whisper.deliveryReceiptQueue.pause();
  window.Whisper.deliveryReceiptBatcher = window.Signal.Util.createBatcher({
    name: 'Whisper.deliveryReceiptBatcher',
    wait: 500,
    maxSize: 500,
    processBatch: async (items: WhatIsThis) => {
      const byConversationId = window._.groupBy(items, item =>
        window.ConversationController.ensureContactIds({
          e164: item.source,
          uuid: item.sourceUuid,
        })
      );
      const ids = Object.keys(byConversationId);

      for (let i = 0, max = ids.length; i < max; i += 1) {
        const conversationId = ids[i];
        const timestamps = byConversationId[conversationId].map(
          item => item.timestamp
        );

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const c = window.ConversationController.get(conversationId)!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const uuid = c.get('uuid')!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const e164 = c.get('e164')!;

        c.queueJob(async () => {
          try {
            const {
              wrap,
              sendOptions,
            } = window.ConversationController.prepareForSend(c.get('id'));
            // eslint-disable-next-line no-await-in-loop
            await wrap(
              window.textsecure.messaging.sendDeliveryReceipt(
                e164,
                uuid,
                timestamps,
                sendOptions
              )
            );
          } catch (error) {
            window.log.error(
              `Failed to send delivery receipt to ${e164}/${uuid} for timestamps ${timestamps}:`,
              error && error.stack ? error.stack : error
            );
          }
        });
      }
    },
  });

  if (getTitleBarVisibility() === TitleBarVisibility.Hidden) {
    window.addEventListener('dblclick', (event: Event) => {
      const target = event.target as HTMLElement;
      if (isWindowDragElement(target)) {
        window.titleBarDoubleClick();
      }
    });
  }

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

  // Keyboard/mouse mode
  let interactionMode: 'mouse' | 'keyboard' = 'mouse';
  $(document.body).addClass('mouse-mode');

  window.enterKeyboardMode = () => {
    if (interactionMode === 'keyboard') {
      return;
    }

    interactionMode = 'keyboard';
    $(document.body).addClass('keyboard-mode').removeClass('mouse-mode');
    const { userChanged } = window.reduxActions.user;
    const { clearSelectedMessage } = window.reduxActions.conversations;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }
    if (userChanged) {
      userChanged({
        interactionMode,
      } as WhatIsThis);
    }
  };
  window.enterMouseMode = () => {
    if (interactionMode === 'mouse') {
      return;
    }

    interactionMode = 'mouse';
    $(document.body).addClass('mouse-mode').removeClass('keyboard-mode');
    const { userChanged } = window.reduxActions.user;
    const { clearSelectedMessage } = window.reduxActions.conversations;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }
    if (userChanged) {
      userChanged({ interactionMode } as WhatIsThis);
    }
  };

  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Tab') {
        window.enterKeyboardMode();
      }
    },
    true
  );
  document.addEventListener('wheel', window.enterMouseMode, true);
  document.addEventListener('mousedown', window.enterMouseMode, true);

  window.getInteractionMode = () => interactionMode;

  // Load these images now to ensure that they don't flicker on first use
  window.preloadedImages = [];
  function preload(list: Array<WhatIsThis>) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      window.preloadedImages.push(image);
    }
  }

  const builtInImages = await window.getBuiltInImages();
  preload(builtInImages);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = window.Signal.Workflow;
  const {
    removeDatabase: removeIndexedDB,
    doesDatabaseExist,
  } = window.Signal.IndexedDB;
  const { Errors, Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    writeNewAttachmentData,
    deleteAttachmentData,
    doesAttachmentExist,
  } = window.Signal.Migrations;
  const { Views } = window.Signal;

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());

  let idleDetector: WhatIsThis;
  let initialLoadComplete = false;
  let newVersion = false;

  window.owsDesktopApp = {};
  window.document.title = window.getTitle();

  window.Whisper.KeyChangeListener.init(window.textsecure.storage.protocol);
  window.textsecure.storage.protocol.on('removePreKey', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.getAccountManager()!.refreshPreKeys();
  });

  let messageReceiver: WhatIsThis;
  let preMessageReceiverStatus: WhatIsThis;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    if (window._.isNumber(preMessageReceiverStatus)) {
      return preMessageReceiverStatus;
    }
    return WebSocket.CLOSED;
  };
  window.Whisper.events = window._.clone(window.Backbone.Events);
  let accountManager: typeof window.textsecure.AccountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const OLD_USERNAME = window.storage.get('number_id');
      const USERNAME = window.storage.get('uuid_id');
      const PASSWORD = window.storage.get('password');
      accountManager = new window.textsecure.AccountManager(
        USERNAME || OLD_USERNAME,
        PASSWORD
      );
      accountManager.addEventListener('registration', () => {
        const ourNumber = window.textsecure.storage.user.getNumber();
        const ourUuid = window.textsecure.storage.user.getUuid();
        const user = {
          regionCode: window.storage.get('regionCode'),
          ourNumber,
          ourUuid,
          ourConversationId: window.ConversationController.getOurConversationId(),
        };
        window.Whisper.events.trigger('userChanged', user);

        window.Signal.Util.Registration.markDone();
        window.log.info('dispatching registration event');
        window.Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const cancelInitializationMessage = Views.Initialization.setMessage();

  const version = await window.Signal.Data.getItemById('version');
  if (!version) {
    const isIndexedDBPresent = await doesDatabaseExist();
    if (isIndexedDBPresent) {
      window.log.info('Found IndexedDB database.');
      try {
        window.log.info('Confirming deletion of old data with user...');

        try {
          await new Promise<void>((resolve, reject) => {
            window.showConfirmationDialog({
              cancelText: window.i18n('quit'),
              confirmStyle: 'negative',
              message: window.i18n('deleteOldIndexedDBData'),
              okText: window.i18n('deleteOldData'),
              reject: () => reject(),
              resolve: () => resolve(),
            });
          });
        } catch (error) {
          window.log.info(
            'User chose not to delete old data. Shutting down.',
            error && error.stack ? error.stack : error
          );
          window.shutdown();
          return;
        }

        window.log.info('Deleting all previously-migrated data in SQL...');
        window.log.info('Deleting IndexedDB file...');

        await Promise.all([
          removeIndexedDB(),
          window.Signal.Data.removeAll(),
          window.Signal.Data.removeIndexedDBFiles(),
        ]);
        window.log.info('Done with SQL deletion and IndexedDB file deletion.');
      } catch (error) {
        window.log.error(
          'Failed to remove IndexedDB file or remove SQL data:',
          error && error.stack ? error.stack : error
        );
      }

      // Set a flag to delete IndexedDB on next startup if it wasn't deleted just now.
      // We need to use direct data calls, since window.storage isn't ready yet.
      await window.Signal.Data.createOrUpdateItem({
        id: 'indexeddb-delete-needed',
        value: true,
      });
    }
  }

  window.log.info('Storage fetch');
  window.storage.fetch();

  function mapOldThemeToNew(theme: WhatIsThis) {
    switch (theme) {
      case 'dark':
      case 'light':
      case 'system':
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
  //   than the first time. And window.storage.fetch() will cause onready() to fire.
  let first = true;
  window.storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => window.textsecure.storage.user.getDeviceName(),

      getThemeSetting: (): 'light' | 'dark' | 'system' =>
        window.storage.get(
          'theme-setting',
          window.platform === 'darwin' ? 'system' : 'light'
        ),
      setThemeSetting: (value: WhatIsThis) => {
        window.storage.put('theme-setting', value);
        onChangeTheme();
      },
      getHideMenuBar: () => window.storage.get('hide-menu-bar'),
      setHideMenuBar: (value: WhatIsThis) => {
        window.storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },

      getNotificationSetting: () =>
        window.storage.get('notification-setting', 'message'),
      setNotificationSetting: (value: WhatIsThis) =>
        window.storage.put('notification-setting', value),
      getNotificationDrawAttention: () =>
        window.storage.get('notification-draw-attention', true),
      setNotificationDrawAttention: (value: WhatIsThis) =>
        window.storage.put('notification-draw-attention', value),
      getAudioNotification: () => window.storage.get('audio-notification'),
      setAudioNotification: (value: WhatIsThis) =>
        window.storage.put('audio-notification', value),
      getCountMutedConversations: () =>
        window.storage.get('badge-count-muted-conversations', false),
      setCountMutedConversations: (value: WhatIsThis) => {
        window.storage.put('badge-count-muted-conversations', value);
        window.Whisper.events.trigger('updateUnreadCount');
      },
      getCallRingtoneNotification: () =>
        window.storage.get('call-ringtone-notification', true),
      setCallRingtoneNotification: (value: WhatIsThis) =>
        window.storage.put('call-ringtone-notification', value),
      getCallSystemNotification: () =>
        window.storage.get('call-system-notification', true),
      setCallSystemNotification: (value: WhatIsThis) =>
        window.storage.put('call-system-notification', value),
      getIncomingCallNotification: () =>
        window.storage.get('incoming-call-notification', true),
      setIncomingCallNotification: (value: WhatIsThis) =>
        window.storage.put('incoming-call-notification', value),

      getSpellCheck: () => window.storage.get('spell-check', true),
      setSpellCheck: (value: WhatIsThis) => {
        window.storage.put('spell-check', value);
      },

      getAlwaysRelayCalls: () => window.storage.get('always-relay-calls'),
      setAlwaysRelayCalls: (value: WhatIsThis) =>
        window.storage.put('always-relay-calls', value),

      // eslint-disable-next-line eqeqeq
      isPrimary: () => window.textsecure.storage.user.getDeviceId() == '1',
      getSyncRequest: () =>
        new Promise((resolve, reject) => {
          const syncRequest = window.getSyncRequest();
          syncRequest.addEventListener('success', resolve);
          syncRequest.addEventListener('timeout', reject);
        }),
      getLastSyncTime: () => window.storage.get('synced_at'),
      setLastSyncTime: (value: WhatIsThis) =>
        window.storage.put('synced_at', value),

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),
      showKeyboardShortcuts: () => window.showKeyboardShortcuts(),

      deleteAllData: () => {
        const clearDataView = new window.Whisper.ClearDataView().render();
        $('body').append(clearDataView.el);
      },

      shutdown: async () => {
        window.log.info('background/shutdown');
        // Stop background processing
        window.Signal.AttachmentDownloads.stop();
        if (idleDetector) {
          idleDetector.stop();
        }

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          await window.waitForAllBatchers();
        }

        if (messageReceiver) {
          messageReceiver.unregisterBatchers();
          messageReceiver = null;
        }

        // A number of still-to-queue database queries might be waiting inside batchers.
        //   We wait for these to empty first, and then shut down the data interface.
        await Promise.all([
          window.waitForAllBatchers(),
          window.waitForAllWaitBatchers(),
        ]);

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },

      showStickerPack: (packId: string, key: string) => {
        // We can get these events even if the user has never linked this instance.
        if (!window.Signal.Util.Registration.everDone()) {
          window.log.warn('showStickerPack: Not registered, returning early');
          return;
        }
        if (window.isShowingModal) {
          window.log.warn(
            'showStickerPack: Already showing modal, returning early'
          );
          return;
        }
        try {
          window.isShowingModal = true;

          // Kick off the download
          window.Signal.Stickers.downloadEphemeralPack(packId, key);

          const props = {
            packId,
            onClose: async () => {
              window.isShowingModal = false;
              stickerPreviewModalView.remove();
              await window.Signal.Stickers.removeEphemeralPack(packId);
            },
          };

          const stickerPreviewModalView = new window.Whisper.ReactWrapperView({
            className: 'sticker-preview-modal-wrapper',
            JSX: window.Signal.State.Roots.createStickerPreviewModal(
              window.reduxStore,
              props
            ),
          });
        } catch (error) {
          window.isShowingModal = false;
          window.log.error(
            'showStickerPack: Ran into an error!',
            error && error.stack ? error.stack : error
          );
          const errorView = new window.Whisper.ReactWrapperView({
            className: 'error-modal-wrapper',
            Component: window.Signal.Components.ErrorModal,
            props: {
              onClose: () => {
                errorView.remove();
              },
            },
          });
        }
      },
      showGroupViaLink: async (hash: string) => {
        // We can get these events even if the user has never linked this instance.
        if (!window.Signal.Util.Registration.everDone()) {
          window.log.warn('showGroupViaLink: Not registered, returning early');
          return;
        }
        if (window.isShowingModal) {
          window.log.warn(
            'showGroupViaLink: Already showing modal, returning early'
          );
          return;
        }
        try {
          await window.Signal.Groups.joinViaLink(hash);
        } catch (error) {
          window.log.error(
            'showGroupViaLink: Ran into an error!',
            error && error.stack ? error.stack : error
          );
          const errorView = new window.Whisper.ReactWrapperView({
            className: 'error-modal-wrapper',
            Component: window.Signal.Components.ErrorModal,
            props: {
              title: window.i18n('GroupV2--join--general-join-failure--title'),
              description: window.i18n('GroupV2--join--general-join-failure'),
              onClose: () => {
                errorView.remove();
              },
            },
          });
        }
        window.isShowingModal = false;
      },

      unknownSignalLink: () => {
        window.log.warn('unknownSignalLink: Showing error dialog');
        const errorView = new window.Whisper.ReactWrapperView({
          className: 'error-modal-wrapper',
          Component: window.Signal.Components.ErrorModal,
          props: {
            description: window.i18n('unknown-sgnl-link'),
            onClose: () => {
              errorView.remove();
            },
          },
        });
      },

      installStickerPack: async (packId: string, key: string) => {
        window.Signal.Stickers.downloadStickerPack(packId, key, {
          finalStatus: 'installed',
        });
      },
    };

    // How long since we were last running?
    const lastHeartbeat = window.storage.get('lastHeartbeat');
    await window.storage.put('lastStartup', Date.now());

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (lastHeartbeat > 0 && isOlderThan(lastHeartbeat, THIRTY_DAYS)) {
      await unlinkAndDisconnect();
    }

    // Start heartbeat timer
    window.storage.put('lastHeartbeat', Date.now());
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(
      () => window.storage.put('lastHeartbeat', Date.now()),
      TWELVE_HOURS
    );

    const currentVersion = window.getVersion();
    const lastVersion = window.storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await window.storage.put('version', currentVersion);

    if (newVersion && lastVersion) {
      window.log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      const themeSetting = window.Events.getThemeSetting();
      const newThemeSetting = mapOldThemeToNew(themeSetting);

      if (window.isBeforeVersion(lastVersion, 'v1.29.2-beta.1')) {
        // Stickers flags
        await Promise.all([
          window.storage.put('showStickersIntroduction', true),
          window.storage.put('showStickerPickerHint', true),
        ]);
      }

      if (window.isBeforeVersion(lastVersion, 'v1.26.0')) {
        // Ensure that we re-register our support for sealed sender
        await window.storage.put(
          'hasRegisterSupportForUnauthenticatedDelivery',
          false
        );
      }

      if (
        window.isBeforeVersion(lastVersion, 'v1.25.0') &&
        window.platform === 'darwin' &&
        newThemeSetting === window.systemTheme
      ) {
        window.Events.setThemeSetting('system');
      } else {
        window.Events.setThemeSetting(newThemeSetting);
      }

      if (
        window.isBeforeVersion(lastVersion, 'v1.36.0-beta.1') &&
        window.isAfterVersion(lastVersion, 'v1.35.0-beta.1')
      ) {
        await window.Signal.Services.eraseAllStorageServiceState();
      }

      if (
        lastVersion === 'v1.40.0-beta.1' &&
        window.isAfterVersion(lastVersion, 'v1.40.0-beta.1')
      ) {
        await window.Signal.Data.clearAllErrorStickerPackAttempts();
      }

      // This one should always be last - it could restart the app
      if (window.isBeforeVersion(lastVersion, 'v1.15.0-beta.5')) {
        await window.Signal.Logs.deleteAll();
        window.restart();
        return;
      }
    }

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    if (newVersion) {
      // We've received reports that this update can take longer than two minutes, so we
      //   allow it to continue and just move on in that timeout case.
      try {
        await window.Signal.Data.cleanupOrphanedAttachments();
      } catch (error) {
        window.log.error(
          'background: Failed to cleanup orphaned attachments:',
          error && error.stack ? error.stack : error
        );
      }

      // Don't block on the following operation
      window.Signal.Data.ensureFilePermissions();
    }

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
          BackboneMessage: window.Whisper.Message,
          BackboneMessageCollection: window.Whisper.MessageCollection,
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

    window.Signal.conversationControllerStart();

    // We start this up before window.ConversationController.load() to
    // ensure that our feature flags are represented in the cached props
    // we generate on load of each convo.
    window.Signal.RemoteConfig.initRemoteConfig();

    try {
      await Promise.all([
        window.ConversationController.load(),
        window.Signal.Stickers.load(),
        window.Signal.Emojis.load(),
        window.textsecure.storage.protocol.hydrateCaches(),
      ]);
      await window.ConversationController.checkForConflicts();
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      initializeRedux();
      start();
      window.Signal.Services.initializeNetworkObserver(
        window.reduxActions.network
      );
      window.Signal.Services.initializeUpdateListener(
        window.reduxActions.updates,
        window.Whisper.events
      );
      window.Signal.Services.calling.initialize(
        window.reduxActions.calling,
        window.getSfuUrl()
      );
      window.reduxActions.expiration.hydrateExpirationStatus(
        window.Signal.Util.hasExpired()
      );
    }
  });

  function initializeRedux() {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();
    const conversations = convoCollection.map(conversation =>
      conversation.format()
    );
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const ourConversationId = window.ConversationController.getOurConversationId();

    const initialState = {
      conversations: {
        conversationLookup: window.Signal.Util.makeLookup(conversations, 'id'),
        conversationsByE164: window.Signal.Util.makeLookup(
          conversations,
          'e164'
        ),
        conversationsByUuid: window.Signal.Util.makeLookup(
          conversations,
          'uuid'
        ),
        conversationsByGroupId: window.Signal.Util.makeLookup(
          conversations,
          'groupId'
        ),
        messagesByConversation: {},
        messagesLookup: {},
        selectedConversationId: undefined,
        selectedMessage: undefined,
        selectedMessageCounter: 0,
        selectedConversationPanelDepth: 0,
        selectedConversationTitle: '',
        showArchived: false,
      },
      emojis: window.Signal.Emojis.getInitialState(),
      items: window.storage.getItemsState(),
      stickers: window.Signal.Stickers.getInitialState(),
      user: {
        attachmentsPath: window.baseAttachmentsPath,
        stickersPath: window.baseStickersPath,
        tempPath: window.baseTempPath,
        regionCode: window.storage.get('regionCode'),
        ourConversationId,
        ourNumber,
        ourUuid,
        platform: window.platform,
        i18n: window.i18n,
        interactionMode: window.getInteractionMode(),
        theme: window.Events.getThemeSetting(),
      },
    };

    const store = window.Signal.State.createStore(initialState);
    window.reduxStore = store;

    const actions: WhatIsThis = {};
    window.reduxActions = actions;

    // Binding these actions to our redux store and exposing them allows us to update
    //   redux when things change in the backbone world.
    actions.calling = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.calling.actions,
      store.dispatch
    );
    actions.conversations = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.conversations.actions,
      store.dispatch
    );
    actions.emojis = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.emojis.actions,
      store.dispatch
    );
    actions.expiration = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.expiration.actions,
      store.dispatch
    );
    actions.items = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.items.actions,
      store.dispatch
    );
    actions.network = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.network.actions,
      store.dispatch
    );
    actions.updates = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.updates.actions,
      store.dispatch
    );
    actions.user = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.user.actions,
      store.dispatch
    );
    actions.search = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.search.actions,
      store.dispatch
    );
    actions.stickers = window.Signal.State.bindActionCreators(
      window.Signal.State.Ducks.stickers.actions,
      store.dispatch
    );

    const {
      conversationAdded,
      conversationChanged,
      conversationRemoved,
      removeAllConversations,
      messageExpired,
    } = actions.conversations;
    const { userChanged } = actions.user;

    convoCollection.on('remove', conversation => {
      const { id } = conversation || {};
      conversationRemoved(id);
    });
    convoCollection.on('add', conversation => {
      if (!conversation) {
        return;
      }
      conversationAdded(conversation.id, conversation.format());
    });
    convoCollection.on('change', conversation => {
      if (!conversation) {
        return;
      }

      // This delay ensures that the .format() call isn't synchronous as a
      //   Backbone property is changed. Important because our _byUuid/_byE164
      //   lookups aren't up-to-date as the change happens; just a little bit
      //   after.
      setTimeout(
        () => conversationChanged(conversation.id, conversation.format()),
        1
      );
    });
    convoCollection.on('reset', removeAllConversations);

    window.Whisper.events.on('messageExpired', messageExpired);
    window.Whisper.events.on('userChanged', userChanged);

    let shortcutGuideView: WhatIsThis | null = null;

    window.showKeyboardShortcuts = () => {
      if (!shortcutGuideView) {
        shortcutGuideView = new window.Whisper.ReactWrapperView({
          className: 'shortcut-guide-wrapper',
          JSX: window.Signal.State.Roots.createShortcutGuideModal(
            window.reduxStore,
            {
              close: () => {
                if (shortcutGuideView) {
                  shortcutGuideView.remove();
                  shortcutGuideView = null;
                }
              },
            }
          ),
          onClose: () => {
            shortcutGuideView = null;
          },
        });
      }
    };

    document.addEventListener('keydown', event => {
      const { ctrlKey, key, metaKey, shiftKey } = event;

      const commandKey = window.platform === 'darwin' && metaKey;
      const controlKey = window.platform !== 'darwin' && ctrlKey;
      const commandOrCtrl = commandKey || controlKey;

      const state = store.getState();
      const selectedId = state.conversations.selectedConversationId;
      const conversation = window.ConversationController.get(selectedId);

      // NAVIGATION

      // Show keyboard shortcuts - handled by Electron-managed keyboard shortcuts
      // However, on linux Ctrl+/ selects all text, so we prevent that
      if (commandOrCtrl && key === '/') {
        window.showKeyboardShortcuts();

        event.stopPropagation();
        event.preventDefault();

        return;
      }

      // Navigate by section
      if (commandOrCtrl && !shiftKey && (key === 't' || key === 'T')) {
        window.enterKeyboardMode();
        const focusedElement = document.activeElement;

        const targets: Array<HTMLElement | null> = [
          document.querySelector('.module-main-header .module-avatar-button'),
          document.querySelector(
            '.module-left-pane__header__contents__back-button'
          ),
          document.querySelector('.module-main-header__search__input'),
          document.querySelector('.module-main-header__compose-icon'),
          document.querySelector(
            '.module-left-pane__compose-search-form__input'
          ),
          document.querySelector('.module-left-pane__list'),
          document.querySelector('.module-search-results'),
          document.querySelector('.module-composition-area .ql-editor'),
        ];
        const focusedIndex = targets.findIndex(target => {
          if (!target || !focusedElement) {
            return false;
          }

          if (target === focusedElement) {
            return true;
          }

          if (target.contains(focusedElement)) {
            return true;
          }

          return false;
        });
        const lastIndex = targets.length - 1;

        let index;
        if (focusedIndex < 0 || focusedIndex >= lastIndex) {
          index = 0;
        } else {
          index = focusedIndex + 1;
        }

        while (!targets[index]) {
          index += 1;
          if (index > lastIndex) {
            index = 0;
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        targets[index]!.focus();
      }

      // Cancel out of keyboard shortcut screen - has first precedence
      if (shortcutGuideView && key === 'Escape') {
        shortcutGuideView.remove();
        shortcutGuideView = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Escape is heavily overloaded - here we avoid clashes with other Escape handlers
      if (key === 'Escape') {
        // Check origin - if within a react component which handles escape, don't handle.
        //   Why? Because React's synthetic events can cause events to be handled twice.
        const target = document.activeElement;

        // We might want to use NamedNodeMap.getNamedItem('class')
        /* eslint-disable @typescript-eslint/no-explicit-any */
        if (
          target &&
          target.attributes &&
          (target.attributes as any).class &&
          (target.attributes as any).class.value
        ) {
          const className = (target.attributes as any).class.value;
          /* eslint-enable @typescript-eslint/no-explicit-any */

          // These want to handle events internally

          // CaptionEditor text box
          if (className.includes('module-caption-editor__caption-input')) {
            return;
          }

          // MainHeader search box
          if (className.includes('module-main-header__search__input')) {
            return;
          }
        }

        // These add listeners to document, but we'll run first
        const confirmationModal = document.querySelector(
          '.module-confirmation-dialog__overlay'
        );
        if (confirmationModal) {
          return;
        }

        const emojiPicker = document.querySelector('.module-emoji-picker');
        if (emojiPicker) {
          return;
        }

        const lightBox = document.querySelector('.module-lightbox');
        if (lightBox) {
          return;
        }

        const stickerPicker = document.querySelector('.module-sticker-picker');
        if (stickerPicker) {
          return;
        }

        const stickerPreview = document.querySelector(
          '.module-sticker-manager__preview-modal__overlay'
        );
        if (stickerPreview) {
          return;
        }

        const reactionViewer = document.querySelector(
          '.module-reaction-viewer'
        );
        if (reactionViewer) {
          return;
        }

        const reactionPicker = document.querySelector(
          '.module-reaction-picker'
        );
        if (reactionPicker) {
          return;
        }

        const contactModal = document.querySelector('.module-contact-modal');
        if (contactModal) {
          return;
        }

        const modalHost = document.querySelector('.module-modal-host__overlay');
        if (modalHost) {
          return;
        }
      }

      // Close window.Backbone-based confirmation dialog
      if (window.Whisper.activeConfirmationView && key === 'Escape') {
        window.Whisper.activeConfirmationView.remove();
        window.Whisper.activeConfirmationView = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Send Escape to active conversation so it can close panels
      if (conversation && key === 'Escape') {
        conversation.trigger('escape-pressed');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Preferences - handled by Electron-managed keyboard shortcuts

      // Open the top-right menu for current conversation
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'l' || key === 'L')
      ) {
        const button = document.querySelector(
          '.module-ConversationHeader__more-button'
        );
        if (!button) {
          return;
        }

        // Because the menu is shown at a location based on the initiating click, we need
        //   to fake up a mouse event to get the menu to show somewhere other than (0,0).
        const { x, y, width, height } = button.getBoundingClientRect();
        const mouseEvent = document.createEvent('MouseEvents');
        // Types do not match signature
        /* eslint-disable @typescript-eslint/no-explicit-any */
        mouseEvent.initMouseEvent(
          'click',
          true, // bubbles
          false, // cancelable
          null as any, // view
          null as any, // detail
          0, // screenX,
          0, // screenY,
          x + width / 2,
          y + height / 2,
          false, // ctrlKey,
          false, // altKey,
          false, // shiftKey,
          false, // metaKey,
          false as any, // button,
          document.body
        );
        /* eslint-enable @typescript-eslint/no-explicit-any */

        button.dispatchEvent(mouseEvent);

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Focus composer field
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 't' || key === 'T')
      ) {
        conversation.trigger('focus-composer');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Open all media
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'm' || key === 'M')
      ) {
        conversation.trigger('open-all-media');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Open emoji picker - handled by component

      // Open sticker picker - handled by component

      // Begin recording voice note
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'v' || key === 'V')
      ) {
        conversation.trigger('begin-recording');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Archive or unarchive conversation
      if (
        conversation &&
        !conversation.get('isArchived') &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'a' || key === 'A')
      ) {
        conversation.setArchived(true);
        conversation.trigger('unload', 'keyboard shortcut archive');
        window.Whisper.ToastView.show(
          window.Whisper.ConversationArchivedToast,
          document.body
        );

        // It's very likely that the act of archiving a conversation will set focus to
        //   'none,' or the top-level body element. This resets it to the left pane.
        if (document.activeElement === document.body) {
          const leftPaneEl: HTMLElement | null = document.querySelector(
            '.module-left-pane__list'
          );
          if (leftPaneEl) {
            leftPaneEl.focus();
          }
        }

        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        conversation &&
        conversation.get('isArchived') &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'u' || key === 'U')
      ) {
        conversation.setArchived(false);
        window.Whisper.ToastView.show(
          window.Whisper.ConversationUnarchivedToast,
          document.body
        );

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Scroll to bottom of list - handled by component

      // Scroll to top of list - handled by component

      // Close conversation
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'c' || key === 'C')
      ) {
        conversation.trigger('unload', 'keyboard shortcut close');
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // MESSAGES

      // Show message details
      if (
        conversation &&
        commandOrCtrl &&
        !shiftKey &&
        (key === 'd' || key === 'D')
      ) {
        const { selectedMessage } = state.conversations;
        if (!selectedMessage) {
          return;
        }

        conversation.trigger('show-message-details', selectedMessage);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Toggle reply to message
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'r' || key === 'R')
      ) {
        const { selectedMessage } = state.conversations;

        conversation.trigger('toggle-reply', selectedMessage);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Save attachment
      if (
        conversation &&
        commandOrCtrl &&
        !shiftKey &&
        (key === 's' || key === 'S')
      ) {
        const { selectedMessage } = state.conversations;

        if (selectedMessage) {
          conversation.trigger('save-attachment', selectedMessage);

          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'd' || key === 'D')
      ) {
        const { selectedMessage } = state.conversations;

        if (selectedMessage) {
          conversation.trigger('delete-message', selectedMessage);

          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // COMPOSER

      // Create a newline in your message - handled by component

      // Expand composer - handled by component

      // Send in expanded composer - handled by component

      // Attach file
      if (
        conversation &&
        commandOrCtrl &&
        !shiftKey &&
        (key === 'u' || key === 'U')
      ) {
        conversation.trigger('attach-file');

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Remove draft link preview
      if (
        conversation &&
        commandOrCtrl &&
        !shiftKey &&
        (key === 'p' || key === 'P')
      ) {
        conversation.trigger('remove-link-review');

        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Attach file
      if (
        conversation &&
        commandOrCtrl &&
        shiftKey &&
        (key === 'p' || key === 'P')
      ) {
        conversation.trigger('remove-all-draft-attachments');

        event.preventDefault();
        event.stopPropagation();
        // Commented out because this is the last item
        // return;
      }
    });
  }

  window.Whisper.events.on('setupAsNewDevice', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openInstaller();
    }
  });

  window.Whisper.events.on('setupAsStandalone', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openStandalone();
    }
  });

  function runStorageService() {
    window.Signal.Services.enableStorageService();
    window.textsecure.messaging.sendRequestKeySyncMessage();
  }

  async function start() {
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');
    const messagesForCleanup = await window.Signal.Data.getOutgoingWithoutExpiresAt(
      {
        MessageCollection: window.Whisper.MessageCollection,
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
          Message: window.Whisper.Message,
        });
        const conversation = message.getConversation();
        if (conversation) {
          await conversation.updateLastMessage();
        }
      })
    );
    window.log.info('Cleanup: complete');

    window.log.info('listening for registration events');
    window.Whisper.events.on('registration_done', () => {
      window.log.info('handling registration event');
      connect(true);
    });

    cancelInitializationMessage();
    const appView = new window.Whisper.AppView({
      el: $('body'),
    });
    window.owsDesktopApp.appView = appView;

    window.Whisper.WallClockListener.init(window.Whisper.events);
    window.Whisper.ExpiringMessagesListener.init(window.Whisper.events);
    window.Whisper.TapToViewMessagesListener.init(window.Whisper.events);

    if (window.Signal.Util.Registration.everDone()) {
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else {
      appView.openInstaller();
    }

    window.Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });
    window.Whisper.events.on('unauthorized', () => {
      appView.inboxView.networkStatusView.update();
    });
    window.Whisper.events.on('contactsync', () => {
      if (appView.installView) {
        appView.openInbox();
      }
    });

    window.registerForActive(() => window.Whisper.Notifications.clear());
    window.addEventListener('unload', () =>
      window.Whisper.Notifications.fastClear()
    );

    window.Whisper.events.on('showConversation', (id, messageId) => {
      if (appView) {
        appView.openConversation(id, messageId);
      }
    });

    window.Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        appView.openConversation(id, messageId);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });

    // Maybe refresh remote configuration when we become active
    window.registerForActive(async () => {
      try {
        await window.Signal.RemoteConfig.maybeRefreshRemoteConfig();
      } catch (error) {
        if (error && window._.isNumber(error.code)) {
          window.log.warn(
            `registerForActive: Failed to to refresh remote config. Code: ${error.code}`
          );
          return;
        }
        throw error;
      }
    });

    // Listen for changes to the `desktop.clientExpiration` remote flag
    window.Signal.RemoteConfig.onChange(
      'desktop.clientExpiration',
      ({ value }) => {
        const remoteBuildExpirationTimestamp = window.Signal.Util.parseRemoteClientExpiration(
          value as string
        );
        if (remoteBuildExpirationTimestamp) {
          window.storage.put(
            'remoteBuildExpiration',
            remoteBuildExpirationTimestamp
          );
          window.reduxActions.expiration.hydrateExpirationStatus(
            window.Signal.Util.hasExpired()
          );
        }
      }
    );

    // Listen for changes to the `desktop.messageRequests` remote configuration flag
    const removeMessageRequestListener = window.Signal.RemoteConfig.onChange(
      'desktop.messageRequests',
      ({ enabled }) => {
        if (!enabled) {
          return;
        }

        const conversations = window.getConversations();
        conversations.forEach(conversation => {
          conversation.set({
            messageCountBeforeMessageRequests:
              conversation.get('messageCount') || 0,
          });
          window.Signal.Data.updateConversation(conversation.attributes);
        });

        removeMessageRequestListener();
      }
    );

    // Listen for changes to the `desktop.gv2` remote configuration flag
    const removeGv2Listener = window.Signal.RemoteConfig.onChange(
      'desktop.gv2',
      async ({ enabled }) => {
        if (!enabled) {
          return;
        }

        // Erase current manifest version so we re-process storage service data
        await window.storage.remove('manifestVersion');

        // Kick off window.storage service fetch to grab GroupV2 information
        await window.Signal.Services.runStorageServiceSyncJob();

        // This is a one-time thing
        removeGv2Listener();
      }
    );

    window.Signal.RemoteConfig.onChange(
      'desktop.storage',
      async ({ enabled }) => {
        if (!enabled) {
          await window.storage.remove('storageKey');
          return;
        }

        await window.storage.remove('manifestVersion');
        await window.textsecure.messaging.sendRequestKeySyncMessage();
      }
    );
  }

  window.getSyncRequest = () =>
    new window.textsecure.SyncRequest(
      window.textsecure.messaging,
      messageReceiver
    );

  let disconnectTimer: WhatIsThis | null = null;
  let reconnectTimer: WhatIsThis | null = null;
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
    window.Signal.AttachmentDownloads.stop();
  }

  let connectCount = 0;
  let connecting = false;
  async function connect(firstRun?: boolean) {
    window.receivedAtCounter =
      window.storage.get('lastReceivedAtCounter') || Date.now();

    if (connecting) {
      window.log.warn('connect already running', { connectCount });
      return;
    }
    try {
      connecting = true;

      window.log.info('connect', { firstRun, connectCount });

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

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

      if (!window.Signal.Util.Registration.everDone()) {
        return;
      }

      preMessageReceiverStatus = WebSocket.CONNECTING;

      if (messageReceiver) {
        await messageReceiver.stopProcessing();

        await window.waitForAllBatchers();
        messageReceiver.unregisterBatchers();

        messageReceiver = null;
      }

      const OLD_USERNAME = window.storage.get('number_id');
      const USERNAME = window.storage.get('uuid_id');
      const PASSWORD = window.storage.get('password');
      const mySignalingKey = window.storage.get('signaling_key');

      window.textsecure.messaging = new window.textsecure.MessageSender(
        USERNAME || OLD_USERNAME,
        PASSWORD
      );

      if (connectCount === 0) {
        try {
          // Force a re-fetch before we process our queue. We may want to turn on
          //   something which changes how we process incoming messages!
          await window.Signal.RemoteConfig.refreshRemoteConfig();
        } catch (error) {
          window.log.error(
            'connect: Error refreshing remote config:',
            error && error.stack ? error.stack : error
          );
        }

        try {
          if (window.Signal.RemoteConfig.isEnabled('desktop.cds')) {
            const lonelyE164s = window
              .getConversations()
              .filter(c =>
                Boolean(
                  c.isPrivate() &&
                    c.get('e164') &&
                    !c.get('uuid') &&
                    !c.isEverUnregistered()
                )
              )
              .map(c => c.get('e164'))
              .filter(Boolean) as Array<string>;

            if (lonelyE164s.length > 0) {
              const lookup = await window.textsecure.messaging.getUuidsForE164s(
                lonelyE164s
              );
              const e164s = Object.keys(lookup);
              e164s.forEach(e164 => {
                const uuid = lookup[e164];
                if (!uuid) {
                  const byE164 = window.ConversationController.get(e164);
                  if (byE164) {
                    byE164.setUnregistered();
                  }
                }
                window.ConversationController.ensureContactIds({
                  e164,
                  uuid,
                  highTrust: true,
                });
              });
            }
          }
        } catch (error) {
          window.log.error(
            'connect: Error fetching UUIDs for lonely e164s:',
            error && error.stack ? error.stack : error
          );
        }
      }

      connectCount += 1;

      window.Whisper.deliveryReceiptQueue.pause(); // avoid flood of delivery receipts until we catch up
      window.Whisper.Notifications.disable(); // avoid notification flood until empty

      // initialize the socket and start listening for messages
      window.log.info('Initializing socket and listening for messages');
      const messageReceiverOptions = {
        serverTrustRoot: window.getServerTrustRoot(),
      };
      messageReceiver = new window.textsecure.MessageReceiver(
        OLD_USERNAME,
        USERNAME,
        PASSWORD,
        mySignalingKey,
        messageReceiverOptions as WhatIsThis
      );
      window.textsecure.messageReceiver = messageReceiver;

      window.Signal.Services.initializeGroupCredentialFetcher();

      preMessageReceiverStatus = null;

      // eslint-disable-next-line no-inner-declarations
      function addQueuedEventListener(name: WhatIsThis, handler: WhatIsThis) {
        messageReceiver.addEventListener(name, (...args: Array<WhatIsThis>) =>
          eventHandlerQueue.add(async () => {
            try {
              await handler(...args);
            } finally {
              // message/sent: Message.handleDataMessage has its own queue and will
              //   trigger this event itself when complete.
              // error: Error processing (below) also has its own queue and self-trigger.
              if (name !== 'message' && name !== 'sent' && name !== 'error') {
                window.Whisper.events.trigger('incrementProgress');
              }
            }
          })
        );
      }

      addQueuedEventListener('message', onMessageReceived);
      addQueuedEventListener('delivery', onDeliveryReceipt);
      addQueuedEventListener('contact', onContactReceived);
      addQueuedEventListener('group', onGroupReceived);
      addQueuedEventListener('sent', onSentMessage);
      addQueuedEventListener('readSync', onReadSync);
      addQueuedEventListener('read', onReadReceipt);
      addQueuedEventListener('verified', onVerified);
      addQueuedEventListener('error', onError);
      addQueuedEventListener('light-session-reset', onLightSessionReset);
      addQueuedEventListener('empty', onEmpty);
      addQueuedEventListener('reconnect', onReconnect);
      addQueuedEventListener('configuration', onConfiguration);
      addQueuedEventListener('typing', onTyping);
      addQueuedEventListener('sticker-pack', onStickerPack);
      addQueuedEventListener('viewSync', onViewSync);
      addQueuedEventListener(
        'messageRequestResponse',
        onMessageRequestResponse
      );
      addQueuedEventListener('profileKeyUpdate', onProfileKeyUpdate);
      addQueuedEventListener('fetchLatest', onFetchLatestSync);
      addQueuedEventListener('keys', onKeysSync);

      window.Signal.AttachmentDownloads.start({
        getMessageReceiver: () => messageReceiver,
        logger: window.log,
      });

      if (connectCount === 1) {
        window.Signal.Stickers.downloadQueuedPacks();
        if (!newVersion) {
          runStorageService();
        }
      }

      // On startup after upgrading to a new version, request a contact sync
      //   (but only if we're not the primary device)
      if (
        !firstRun &&
        connectCount === 1 &&
        newVersion &&
        // eslint-disable-next-line eqeqeq
        window.textsecure.storage.user.getDeviceId() != '1'
      ) {
        window.log.info('Boot after upgrading. Requesting contact sync');
        window.getSyncRequest();

        runStorageService();

        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const manager = window.getAccountManager()!;
          await Promise.all([
            manager.maybeUpdateDeviceName(),
            manager.maybeDeleteSignalingKey(),
          ]);
        } catch (e) {
          window.log.error(
            'Problem with account manager updates after starting new version: ',
            e && e.stack ? e.stack : e
          );
        }
      }

      const udSupportKey = 'hasRegisterSupportForUnauthenticatedDelivery';
      if (!window.storage.get(udSupportKey)) {
        const server = window.WebAPI.connect({
          username: USERNAME || OLD_USERNAME,
          password: PASSWORD,
        });
        try {
          await server.registerSupportForUnauthenticatedDelivery();
          window.storage.put(udSupportKey, true);
        } catch (error) {
          window.log.error(
            'Error: Unable to register for unauthenticated delivery support.',
            error && error.stack ? error.stack : error
          );
        }
      }

      const deviceId = window.textsecure.storage.user.getDeviceId();

      // If we didn't capture a UUID on registration, go get it from the server
      if (!window.textsecure.storage.user.getUuid()) {
        const server = window.WebAPI.connect({
          username: OLD_USERNAME,
          password: PASSWORD,
        });
        try {
          const { uuid } = await server.whoami();
          window.textsecure.storage.user.setUuidAndDeviceId(
            uuid,
            deviceId as WhatIsThis
          );
          const ourNumber = window.textsecure.storage.user.getNumber();
          const me = await window.ConversationController.getOrCreateAndWait(
            ourNumber,
            'private'
          );
          me.updateUuid(uuid);
        } catch (error) {
          window.log.error(
            'Error: Unable to retrieve UUID from service.',
            error && error.stack ? error.stack : error
          );
        }
      }

      if (connectCount === 1) {
        const server = window.WebAPI.connect({
          username: USERNAME || OLD_USERNAME,
          password: PASSWORD,
        });
        try {
          // Note: we always have to register our capabilities all at once, so we do this
          //   after connect on every startup
          await server.registerCapabilities({
            'gv2-3': true,
            'gv1-migration': true,
          });
        } catch (error) {
          window.log.error(
            'Error: Unable to register our capabilities.',
            error && error.stack ? error.stack : error
          );
        }
      }

      if (firstRun === true && deviceId !== '1') {
        const hasThemeSetting = Boolean(window.storage.get('theme-setting'));
        if (
          !hasThemeSetting &&
          window.textsecure.storage.get('userAgent') === 'OWI'
        ) {
          window.storage.put(
            'theme-setting',
            await window.Events.getThemeSetting()
          );
          onChangeTheme();
        }
        const syncRequest = new window.textsecure.SyncRequest(
          window.textsecure.messaging,
          messageReceiver
        );
        window.Whisper.events.trigger('contactsync:begin');
        syncRequest.addEventListener('success', () => {
          window.log.info('sync successful');
          window.storage.put('synced_at', Date.now());
          window.Whisper.events.trigger('contactsync');
          runStorageService();
        });
        syncRequest.addEventListener('timeout', () => {
          window.log.error('sync timed out');
          window.Whisper.events.trigger('contactsync');
          runStorageService();
        });

        const ourId = window.ConversationController.getOurConversationId();
        const {
          wrap,
          sendOptions,
        } = window.ConversationController.prepareForSend(ourId, {
          syncMessage: true,
        });

        const installedStickerPacks = window.Signal.Stickers.getInstalledStickerPacks();
        if (installedStickerPacks.length) {
          const operations = installedStickerPacks.map((pack: WhatIsThis) => ({
            packId: pack.id,
            packKey: pack.key,
            installed: true,
          }));

          wrap(
            window.textsecure.messaging.sendStickerPackSync(
              operations,
              sendOptions
            )
          ).catch(error => {
            window.log.error(
              'Failed to send installed sticker packs via sync message',
              error && error.stack ? error.stack : error
            );
          });
        }
      }

      window.storage.onready(async () => {
        idleDetector.start();

        // Kick off a profile refresh if necessary, but don't wait for it, as failure is
        //   tolerable.
        const ourConversationId = window.ConversationController.getOurConversationId();
        if (ourConversationId) {
          routineProfileRefresh({
            allConversations: window.ConversationController.getAll(),
            ourConversationId,
            storage: window.storage,
          });
        } else {
          assert(
            false,
            'Failed to fetch our conversation ID. Skipping routine profile refresh'
          );
        }
      });
    } finally {
      connecting = false;
    }
  }

  function onChangeTheme() {
    const view = window.owsDesktopApp.appView;
    if (view) {
      view.applyTheme();
    }

    if (window.reduxActions && window.reduxActions.user) {
      const theme = window.Events.getThemeSetting();
      window.reduxActions.user.userChanged({
        theme: theme === 'system' ? window.systemTheme : theme,
      });
    }
  }

  const FIVE_MINUTES = 5 * 60 * 1000;

  // Note: once this function returns, there still might be messages being processed on
  //   a given conversation's queue. But we have processed all events from the websocket.
  async function waitForEmptyEventQueue() {
    if (!messageReceiver) {
      window.log.info(
        'waitForEmptyEventQueue: No messageReceiver available, returning early'
      );
      return;
    }

    if (!messageReceiver.hasEmptied()) {
      window.log.info(
        'waitForEmptyEventQueue: Waiting for MessageReceiver empty event...'
      );
      let resolve: WhatIsThis;
      let reject: WhatIsThis;
      const promise = new Promise((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });

      const timeout = setTimeout(reject, FIVE_MINUTES);
      const onEmptyOnce = () => {
        messageReceiver.removeEventListener('empty', onEmptyOnce);
        clearTimeout(timeout);
        resolve();
      };
      messageReceiver.addEventListener('empty', onEmptyOnce);

      await promise;
    }

    window.log.info(
      'waitForEmptyEventQueue: Waiting for event handler queue idle...'
    );
    await eventHandlerQueue.onIdle();
  }

  window.waitForEmptyEventQueue = waitForEmptyEventQueue;

  async function onEmpty() {
    await Promise.all([
      window.waitForAllBatchers(),
      window.flushAllWaitBatchers(),
    ]);
    window.log.info('onEmpty: All outstanding database requests complete');
    initialLoadComplete = true;
    window.readyForUpdates();

    // Start listeners here, after we get through our queue.
    window.Whisper.RotateSignedPreKeyListener.init(
      window.Whisper.events,
      newVersion
    );

    [SenderCertificateMode.WithE164, SenderCertificateMode.WithoutE164].forEach(
      mode => {
        refreshSenderCertificate.initialize({
          events: window.Whisper.events,
          storage: window.storage,
          mode,
          navigator,
        });
      }
    );

    window.Whisper.deliveryReceiptQueue.start();
    window.Whisper.Notifications.enable();

    const view = window.owsDesktopApp.appView;
    if (!view) {
      throw new Error('Expected `appView` to be initialized');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    view.onEmpty();

    window.logAppLoadedEvent();
    if (messageReceiver) {
      window.log.info(
        'App loaded - messages:',
        messageReceiver.getProcessedCount()
      );
    }

    await window.sqlInitializer.goBackToMainProcess();
    window.Signal.Util.setBatchingStrategy(false);

    const attachmentDownloadQueue = window.attachmentDownloadQueue || [];

    // NOTE: ts/models/messages.ts expects this global to become undefined
    // once we stop processing the queue.
    window.attachmentDownloadQueue = undefined;

    const MAX_ATTACHMENT_MSGS_TO_DOWNLOAD = 250;
    const attachmentsToDownload = attachmentDownloadQueue.filter(
      (message, index) =>
        index <= MAX_ATTACHMENT_MSGS_TO_DOWNLOAD ||
        isMoreRecentThan(
          message.getReceivedAt(),
          MAX_ATTACHMENT_DOWNLOAD_AGE
        ) ||
        // Stickers and long text attachments has to be downloaded for UI
        // to display the message properly.
        message.hasRequiredAttachmentDownloads()
    );
    window.log.info(
      'Downloading recent attachments of total attachments',
      attachmentsToDownload.length,
      attachmentDownloadQueue.length
    );

    if (window.startupProcessingQueue) {
      window.startupProcessingQueue.flush();
      window.startupProcessingQueue = undefined;
    }

    const messagesWithDownloads = await Promise.all(
      attachmentsToDownload.map(message => message.queueAttachmentDownloads())
    );
    const messagesToSave: Array<MessageAttributesType> = [];
    messagesWithDownloads.forEach((shouldSave, messageKey) => {
      if (shouldSave) {
        const message = attachmentsToDownload[messageKey];
        messagesToSave.push(message.attributes);
      }
    });
    await window.Signal.Data.saveMessages(messagesToSave, {});
  }
  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    window.Whisper.deliveryReceiptQueue.pause();
    window.Whisper.Notifications.disable();
  }

  let initialStartupCount = 0;
  window.Whisper.events.on('incrementProgress', incrementProgress);
  function incrementProgress() {
    initialStartupCount += 1;

    // Only update progress every 10 items
    if (initialStartupCount % 10 !== 0) {
      return;
    }

    window.log.info(
      `incrementProgress: Message count is ${initialStartupCount}`
    );

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(initialStartupCount);
    }
  }

  window.Whisper.events.on('manualConnect', manualConnect);
  function manualConnect() {
    if (isSocketOnline()) {
      window.log.info('manualConnect: already online; not connecting again');
      return;
    }

    window.log.info('manualConnect: calling connect()');
    connect();
  }

  function onConfiguration(ev: WhatIsThis) {
    ev.confirm();

    const { configuration } = ev;
    const {
      readReceipts,
      typingIndicators,
      unidentifiedDeliveryIndicators,
      linkPreviews,
    } = configuration;

    window.storage.put('read-receipt-setting', readReceipts);

    if (
      unidentifiedDeliveryIndicators === true ||
      unidentifiedDeliveryIndicators === false
    ) {
      window.storage.put(
        'unidentifiedDeliveryIndicators',
        unidentifiedDeliveryIndicators
      );
    }

    if (typingIndicators === true || typingIndicators === false) {
      window.storage.put('typingIndicators', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      window.storage.put('linkPreviews', linkPreviews);
    }
  }

  function onTyping(ev: WhatIsThis) {
    // Note: this type of message is automatically removed from cache in MessageReceiver

    const { typing, sender, senderUuid, senderDevice } = ev;
    const { groupId, groupV2Id, started } = typing || {};

    // We don't do anything with incoming typing messages if the setting is disabled
    if (!window.storage.get('typingIndicators')) {
      return;
    }

    let conversation;

    const senderId = window.ConversationController.ensureContactIds({
      e164: sender,
      uuid: senderUuid,
      highTrust: true,
    });

    // We multiplex between GV1/GV2 groups here, but we don't kick off migrations
    if (groupV2Id) {
      conversation = window.ConversationController.get(groupV2Id);
    }
    if (!conversation && groupId) {
      conversation = window.ConversationController.get(groupId);
    }
    if (!groupV2Id && !groupId && senderId) {
      conversation = window.ConversationController.get(senderId);
    }

    const ourId = window.ConversationController.getOurConversationId();

    if (!senderId) {
      window.log.warn('onTyping: ensureContactIds returned falsey senderId!');
      return;
    }
    if (!ourId) {
      window.log.warn("onTyping: Couldn't get our own id!");
      return;
    }
    if (!conversation) {
      window.log.warn(
        `onTyping: Did not find conversation for typing indicator (groupv2(${groupV2Id}), group(${groupId}), ${sender}, ${senderUuid})`
      );
      return;
    }

    // We drop typing notifications in groups we're not a part of
    if (!conversation.isPrivate() && !conversation.hasMember(ourId)) {
      window.log.warn(
        `Received typing indicator for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
      );
      return;
    }

    conversation.notifyTyping({
      isTyping: started,
      fromMe: senderId === ourId,
      senderId,
      senderDevice,
    });
  }

  async function onStickerPack(ev: WhatIsThis) {
    ev.confirm();

    const packs = ev.stickerPacks || [];

    packs.forEach((pack: WhatIsThis) => {
      const { id, key, isInstall, isRemove } = pack || {};

      if (!id || !key || (!isInstall && !isRemove)) {
        window.log.warn(
          'Received malformed sticker pack operation sync message'
        );
        return;
      }

      const status = window.Signal.Stickers.getStickerPackStatus(id);

      if (status === 'installed' && isRemove) {
        window.reduxActions.stickers.uninstallStickerPack(id, key, {
          fromSync: true,
        });
      } else if (isInstall) {
        if (status === 'downloaded') {
          window.reduxActions.stickers.installStickerPack(id, key, {
            fromSync: true,
          });
        } else {
          window.Signal.Stickers.downloadStickerPack(id, key, {
            finalStatus: 'installed',
            fromSync: true,
          });
        }
      }
    });
  }

  async function onContactReceived(ev: WhatIsThis) {
    const details = ev.contactDetails;

    if (
      (details.number &&
        details.number === window.textsecure.storage.user.getNumber()) ||
      (details.uuid &&
        details.uuid === window.textsecure.storage.user.getUuid())
    ) {
      // special case for syncing details about ourselves
      if (details.profileKey) {
        window.log.info('Got sync message with our own profile key');
        window.storage.put('profileKey', details.profileKey);
      }
    }

    const c = new window.Whisper.Conversation({
      e164: details.number,
      uuid: details.uuid,
      type: 'private',
    } as WhatIsThis);
    const validationError = c.validate();
    if (validationError) {
      window.log.error(
        'Invalid contact received:',
        Errors.toLogFormat(validationError as WhatIsThis)
      );
      return;
    }

    try {
      const detailsId = window.ConversationController.ensureContactIds({
        e164: details.number,
        uuid: details.uuid,
        highTrust: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const conversation = window.ConversationController.get(detailsId)!;
      let activeAt = conversation.get('active_at');

      // The idea is to make any new contact show up in the left pane. If
      //   activeAt is null, then this contact has been purposefully hidden.
      if (activeAt !== null) {
        activeAt = activeAt || Date.now();
      }

      if (details.profileKey) {
        const profileKey = window.Signal.Crypto.arrayBufferToBase64(
          details.profileKey
        );
        conversation.setProfileKey(profileKey);
      }

      if (typeof details.blocked !== 'undefined') {
        if (details.blocked) {
          conversation.block();
        } else {
          conversation.unblock();
        }
      }

      conversation.set({
        name: details.name,
        color: details.color,
        active_at: activeAt,
        inbox_position: details.inboxPosition,
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
            doesAttachmentExist,
          }
        );
        conversation.set(newAttributes);
      } else {
        const { attributes } = conversation;
        if (attributes.avatar && attributes.avatar.path) {
          await deleteAttachmentData(attributes.avatar.path);
        }
        conversation.set({ avatar: null });
      }

      window.Signal.Data.updateConversation(conversation.attributes);

      const { expireTimer } = details;
      const isValidExpireTimer = typeof expireTimer === 'number';
      if (isValidExpireTimer) {
        const ourId = window.ConversationController.getOurConversationId();
        const receivedAt = Date.now();

        await conversation.updateExpirationTimer(
          expireTimer,
          ourId,
          receivedAt,
          {
            fromSync: true,
          }
        );
      }

      if (details.verified) {
        const { verified } = details;
        const verifiedEvent = new Event('verified');
        verifiedEvent.verified = {
          state: verified.state,
          destination: verified.destination,
          destinationUuid: verified.destinationUuid,
          identityKey: verified.identityKey.toArrayBuffer(),
        };
        (verifiedEvent as WhatIsThis).viaContactSync = true;
        await onVerified(verifiedEvent);
      }

      const { appView } = window.owsDesktopApp;
      if (appView && appView.installView && appView.installView.didLink) {
        window.log.info(
          'onContactReceived: Adding the message history disclaimer on link'
        );
        await conversation.addMessageHistoryDisclaimer();
      }
    } catch (error) {
      window.log.error('onContactReceived error:', Errors.toLogFormat(error));
    }
  }

  // Note: this handler is only for v1 groups received via 'group sync' messages
  async function onGroupReceived(ev: WhatIsThis) {
    const details = ev.groupDetails;
    const { id } = details;

    const idBuffer = window.Signal.Crypto.fromEncodedBinaryToArrayBuffer(id);
    const idBytes = idBuffer.byteLength;
    if (idBytes !== 16) {
      window.log.error(
        `onGroupReceived: Id was ${idBytes} bytes, expected 16 bytes. Dropping group.`
      );
      return;
    }

    const conversation = await window.ConversationController.getOrCreateAndWait(
      id,
      'group'
    );
    if (conversation.isGroupV2()) {
      window.log.warn(
        'Got group sync for v2 group: ',
        conversation.idForLogging()
      );
      return;
    }

    const memberConversations = details.membersE164.map((e164: WhatIsThis) =>
      window.ConversationController.getOrCreate(e164, 'private')
    );

    const members = memberConversations.map((c: WhatIsThis) => c.get('id'));

    const updates = {
      name: details.name,
      members,
      color: details.color,
      type: 'group',
      inbox_position: details.inboxPosition,
    } as WhatIsThis;

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
      conversation.block();
    } else {
      conversation.unblock();
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
          doesAttachmentExist,
        }
      );
      conversation.set(newAttributes);
    }

    window.Signal.Data.updateConversation(conversation.attributes);

    const { appView } = window.owsDesktopApp;
    if (appView && appView.installView && appView.installView.didLink) {
      window.log.info(
        'onGroupReceived: Adding the message history disclaimer on link'
      );
      await conversation.addMessageHistoryDisclaimer();
    }
    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (!isValidExpireTimer) {
      return;
    }

    const receivedAt = Date.now();
    await conversation.updateExpirationTimer(
      expireTimer,
      window.ConversationController.getOurConversationId(),
      receivedAt,
      {
        fromSync: true,
      }
    );
  }

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }: WhatIsThis) {
    const profileKey = data.message.profileKey.toString('base64');
    const sender = window.ConversationController.get(messageDescriptor.id);

    if (sender) {
      // Will do the save for us
      await sender.setProfileKey(profileKey);
    }

    return confirm();
  }

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  function onMessageReceived(event: WhatIsThis) {
    const { data, confirm } = event;

    const messageDescriptor = getMessageDescriptor({
      ...data,
      // 'message' event: for 1:1 converations, the conversation is same as sender
      destination: data.source,
      destinationUuid: data.sourceUuid,
    });

    const { PROFILE_KEY_UPDATE } = window.textsecure.protobuf.DataMessage.Flags;
    // eslint-disable-next-line no-bitwise
    const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
    if (isProfileUpdate) {
      return handleMessageReceivedProfileUpdate({
        data,
        confirm,
        messageDescriptor,
      });
    }

    const message = initIncomingMessage(data, messageDescriptor);

    if (data.message.reaction) {
      window.normalizeUuids(
        data.message.reaction,
        ['targetAuthorUuid'],
        'background::onMessageReceived'
      );

      const { reaction } = data.message;
      window.log.info(
        'Queuing incoming reaction for',
        reaction.targetTimestamp
      );
      const reactionModel = window.Whisper.Reactions.add({
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid: reaction.targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp: Date.now(),
        fromId: window.ConversationController.ensureContactIds({
          e164: data.source,
          uuid: data.sourceUuid,
        }),
      });
      // Note: We do not wait for completion here
      window.Whisper.Reactions.onReaction(reactionModel);
      confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      window.log.info('Queuing incoming DOE for', del.targetSentTimestamp);
      const deleteModel = window.Whisper.Deletes.add({
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: window.ConversationController.ensureContactIds({
          e164: data.source,
          uuid: data.sourceUuid,
        }),
      });
      // Note: We do not wait for completion here
      window.Whisper.Deletes.onDelete(deleteModel);
      confirm();
      return Promise.resolve();
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      return Promise.resolve();
    }

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    message.handleDataMessage(data.message, event.confirm);

    return Promise.resolve();
  }

  async function onProfileKeyUpdate({ data, confirm }: WhatIsThis) {
    const conversationId = window.ConversationController.ensureContactIds({
      e164: data.source,
      uuid: data.sourceUuid,
      highTrust: true,
    });
    const conversation = window.ConversationController.get(conversationId);

    if (!conversation) {
      window.log.error(
        'onProfileKeyUpdate: could not find conversation',
        data.source,
        data.sourceUuid
      );
      confirm();
      return;
    }

    if (!data.profileKey) {
      window.log.error(
        'onProfileKeyUpdate: missing profileKey',
        data.profileKey
      );
      confirm();
      return;
    }

    window.log.info(
      'onProfileKeyUpdate: updating profileKey',
      data.source,
      data.sourceUuid
    );

    await conversation.setProfileKey(data.profileKey);

    confirm();
  }

  async function handleMessageSentProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }: WhatIsThis) {
    // First set profileSharing = true for the conversation we sent to
    const { id } = messageDescriptor;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conversation = window.ConversationController.get(id)!;

    conversation.enableProfileSharing();
    window.Signal.Data.updateConversation(conversation.attributes);

    // Then we update our own profileKey if it's different from what we have
    const ourId = window.ConversationController.getOurConversationId();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const me = window.ConversationController.get(ourId)!;
    const profileKey = data.message.profileKey.toString('base64');

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);

    return confirm();
  }

  function createSentMessage(data: WhatIsThis, descriptor: WhatIsThis) {
    const now = Date.now();
    let sentTo = [];

    if (data.unidentifiedStatus && data.unidentifiedStatus.length) {
      sentTo = data.unidentifiedStatus.map(
        (item: WhatIsThis) => item.destinationUuid || item.destination
      );
      const unidentified = window._.filter(data.unidentifiedStatus, item =>
        Boolean(item.unidentified)
      );
      // eslint-disable-next-line no-param-reassign
      data.unidentifiedDeliveries = unidentified.map(
        item => item.destinationUuid || item.destination
      );
    }

    return new window.Whisper.Message({
      source: window.textsecure.storage.user.getNumber(),
      sourceUuid: window.textsecure.storage.user.getUuid(),
      sourceDevice: data.device,
      sent_at: data.timestamp,
      serverTimestamp: data.serverTimestamp,
      sent_to: sentTo,
      received_at: data.receivedAtCounter,
      received_at_ms: data.receivedAtDate,
      conversationId: descriptor.id,
      type: 'outgoing',
      sent: true,
      unidentifiedDeliveries: data.unidentifiedDeliveries || [],
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || data.timestamp || now,
        now
      ),
    } as WhatIsThis);
  }

  // Works with 'sent' and 'message' data sent from MessageReceiver, with a little massage
  //   at callsites to make sure both source and destination are populated.
  const getMessageDescriptor = ({
    message,
    source,
    sourceUuid,
    destination,
    destinationUuid,
  }: {
    message: DataMessageClass;
    source: string;
    sourceUuid: string;
    destination: string;
    destinationUuid: string;
  }): MessageDescriptor => {
    if (message.groupV2) {
      const { id } = message.groupV2;
      if (!id) {
        throw new Error('getMessageDescriptor: GroupV2 data was missing an id');
      }

      // First we check for an existing GroupV2 group
      const groupV2 = window.ConversationController.get(id);
      if (groupV2) {
        return {
          type: Message.GROUP,
          id: groupV2.id,
        };
      }

      // Then check for V1 group with matching derived GV2 id
      const groupV1 = window.ConversationController.getByDerivedGroupV2Id(id);
      if (groupV1) {
        return {
          type: Message.GROUP,
          id: groupV1.id,
        };
      }

      // Finally create the V2 group normally
      const conversationId = window.ConversationController.ensureGroup(id, {
        // Note: We don't set active_at, because we don't want the group to show until
        //   we have information about it beyond these initial details.
        //   see maybeUpdateGroup().
        groupVersion: 2,
        masterKey: message.groupV2.masterKey,
        secretParams: message.groupV2.secretParams,
        publicParams: message.groupV2.publicParams,
      });

      return {
        type: Message.GROUP,
        id: conversationId,
      };
    }
    if (message.group) {
      const { id, derivedGroupV2Id } = message.group;
      if (!id) {
        throw new Error('getMessageDescriptor: GroupV1 data was missing id');
      }
      if (!derivedGroupV2Id) {
        window.log.warn(
          'getMessageDescriptor: GroupV1 data was missing derivedGroupV2Id'
        );
      } else {
        // First we check for an already-migrated GroupV2 group
        const migratedGroup = window.ConversationController.get(
          derivedGroupV2Id
        );
        if (migratedGroup) {
          return {
            type: Message.GROUP,
            id: migratedGroup.id,
          };
        }
      }

      // If we can't find one, we treat this as a normal GroupV1 group
      const fromContactId = window.ConversationController.ensureContactIds({
        e164: source,
        uuid: sourceUuid,
        highTrust: true,
      });

      const conversationId = window.ConversationController.ensureGroup(id, {
        addedBy: fromContactId,
      });

      return {
        type: Message.GROUP,
        id: conversationId,
      };
    }

    const id = window.ConversationController.ensureContactIds({
      e164: destination,
      uuid: destinationUuid,
      highTrust: true,
    });
    if (!id) {
      throw new Error(
        'getMessageDescriptor: ensureContactIds returned falsey id'
      );
    }

    return {
      type: Message.PRIVATE,
      id,
    };
  };

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  function onSentMessage(event: WhatIsThis) {
    const { data, confirm } = event;

    const messageDescriptor = getMessageDescriptor({
      ...data,
      // 'sent' event: the sender is always us!
      source: window.textsecure.storage.user.getNumber(),
      sourceUuid: window.textsecure.storage.user.getUuid(),
    });

    const { PROFILE_KEY_UPDATE } = window.textsecure.protobuf.DataMessage.Flags;
    // eslint-disable-next-line no-bitwise
    const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
    if (isProfileUpdate) {
      return handleMessageSentProfileUpdate({
        data,
        confirm,
        messageDescriptor,
      });
    }

    const message = createSentMessage(data, messageDescriptor);

    if (data.message.reaction) {
      window.normalizeUuids(
        data.message.reaction,
        ['targetAuthorUuid'],
        'background::onSentMessage'
      );

      const { reaction } = data.message;
      window.log.info('Queuing sent reaction for', reaction.targetTimestamp);
      const reactionModel = window.Whisper.Reactions.add({
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid: reaction.targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp: Date.now(),
        fromId: window.ConversationController.getOurConversationId(),
        fromSync: true,
      });
      // Note: We do not wait for completion here
      window.Whisper.Reactions.onReaction(reactionModel);

      event.confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      window.log.info('Queuing sent DOE for', del.targetSentTimestamp);
      const deleteModel = window.Whisper.Deletes.add({
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: del.serverTimestamp,
        fromId: window.ConversationController.getOurConversationId(),
      });
      // Note: We do not wait for completion here
      window.Whisper.Deletes.onDelete(deleteModel);
      confirm();
      return Promise.resolve();
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      return Promise.resolve();
    }

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    message.handleDataMessage(data.message, event.confirm, {
      data,
    });

    return Promise.resolve();
  }

  type MessageDescriptor = {
    type: 'private' | 'group';
    id: string;
  };

  function initIncomingMessage(
    data: WhatIsThis,
    descriptor: MessageDescriptor
  ) {
    assert(
      Boolean(data.receivedAtCounter),
      `Did not receive receivedAtCounter for message: ${data.timestamp}`
    );
    return new window.Whisper.Message({
      source: data.source,
      sourceUuid: data.sourceUuid,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      serverTimestamp: data.serverTimestamp,
      received_at: data.receivedAtCounter,
      received_at_ms: data.receivedAtDate,
      conversationId: descriptor.id,
      unidentifiedDeliveryReceived: data.unidentifiedDeliveryReceived,
      type: 'incoming',
      unread: 1,
    } as WhatIsThis);
  }

  // Returns `false` if this message isn't a group call message.
  function handleGroupCallUpdateMessage(
    message: DataMessageClass,
    messageDescriptor: MessageDescriptor
  ): boolean {
    if (message.groupCallUpdate) {
      if (message.groupV2 && messageDescriptor.type === Message.GROUP) {
        if (window.isGroupCallingEnabled()) {
          window.reduxActions.calling.peekNotConnectedGroupCall({
            conversationId: messageDescriptor.id,
          });
        }
        return true;
      }
      window.log.warn(
        'Received a group call update for a conversation that is not a GV2 group. Ignoring that property and continuing.'
      );
    }
    return false;
  }

  async function unlinkAndDisconnect() {
    window.Whisper.events.trigger('unauthorized');

    if (messageReceiver) {
      await messageReceiver.stopProcessing();

      await window.waitForAllBatchers();
      messageReceiver.unregisterBatchers();

      messageReceiver = null;
    }

    onEmpty();

    window.log.warn(
      'Client is no longer authorized; deleting local configuration'
    );
    window.Signal.Util.Registration.remove();

    const NUMBER_ID_KEY = 'number_id';
    const VERSION_KEY = 'version';
    const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
    const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

    const previousNumberId = window.textsecure.storage.get(NUMBER_ID_KEY);
    const lastProcessedIndex = window.textsecure.storage.get(
      LAST_PROCESSED_INDEX_KEY
    );
    const isMigrationComplete = window.textsecure.storage.get(
      IS_MIGRATION_COMPLETE_KEY
    );

    try {
      await window.textsecure.storage.protocol.removeAllConfiguration();

      // These two bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
      window.Signal.Util.Registration.markEverDone();
      await window.textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);

      // These two are important to ensure we don't rip through every message
      //   in the database attempting to upgrade it after starting up again.
      await window.textsecure.storage.put(
        IS_MIGRATION_COMPLETE_KEY,
        isMigrationComplete || false
      );
      await window.textsecure.storage.put(
        LAST_PROCESSED_INDEX_KEY,
        lastProcessedIndex || null
      );
      await window.textsecure.storage.put(VERSION_KEY, window.getVersion());

      window.log.info('Successfully cleared local configuration');
    } catch (eraseError) {
      window.log.error(
        'Something went wrong clearing local configuration',
        eraseError && eraseError.stack ? eraseError.stack : eraseError
      );
    }
  }

  function onError(ev: WhatIsThis) {
    const { error } = ev;
    window.log.error('background onError:', Errors.toLogFormat(error));

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === 401 || error.code === 403)
    ) {
      unlinkAndDisconnect();
      return;
    }

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === -1 || error.code === 502)
    ) {
      // Failed to connect to server
      if (navigator.onLine) {
        window.log.info('retrying in 1 minute');
        reconnectTimer = setTimeout(connect, 60000);

        window.Whisper.events.trigger('reconnectTimer');
      }
      return;
    }

    window.log.warn('background onError: Doing nothing with incoming error');
  }

  type LightSessionResetEventType = {
    senderUuid: string;
  };

  function onLightSessionReset(event: LightSessionResetEventType) {
    const conversationId = window.ConversationController.ensureContactIds({
      uuid: event.senderUuid,
    });

    if (!conversationId) {
      window.log.warn(
        'onLightSessionReset: No conversation id, cannot add message to timeline'
      );
      return;
    }
    const conversation = window.ConversationController.get(conversationId);

    if (!conversation) {
      window.log.warn(
        'onLightSessionReset: No conversation, cannot add message to timeline'
      );
      return;
    }

    const receivedAt = Date.now();
    conversation.queueJob(async () => {
      conversation.addChatSessionRefreshed(receivedAt);
    });
  }

  async function onViewSync(ev: WhatIsThis) {
    ev.confirm();

    const { source, sourceUuid, timestamp } = ev;
    window.log.info(`view sync ${source} ${timestamp}`);

    const sync = window.Whisper.ViewSyncs.add({
      source,
      sourceUuid,
      timestamp,
    });

    window.Whisper.ViewSyncs.onSync(sync);
  }

  async function onFetchLatestSync(ev: WhatIsThis) {
    ev.confirm();

    const { eventType } = ev;

    const FETCH_LATEST_ENUM =
      window.textsecure.protobuf.SyncMessage.FetchLatest.Type;

    switch (eventType) {
      case FETCH_LATEST_ENUM.LOCAL_PROFILE:
        // Intentionally do nothing since we'll be receiving the
        // window.storage manifest request and will update local profile along with that.
        break;
      case FETCH_LATEST_ENUM.STORAGE_MANIFEST:
        window.log.info('onFetchLatestSync: fetching latest manifest');
        await window.Signal.Services.runStorageServiceSyncJob();
        break;
      default:
        window.log.info(
          `onFetchLatestSync: Unknown type encountered ${eventType}`
        );
    }
  }

  async function onKeysSync(ev: WhatIsThis) {
    ev.confirm();

    const { storageServiceKey } = ev;

    if (storageServiceKey === null) {
      window.log.info('onKeysSync: deleting window.storageKey');
      window.storage.remove('storageKey');
    }

    if (storageServiceKey) {
      window.log.info('onKeysSync: received keys');
      const storageServiceKeyBase64 = window.Signal.Crypto.arrayBufferToBase64(
        storageServiceKey
      );
      window.storage.put('storageKey', storageServiceKeyBase64);

      await window.Signal.Services.runStorageServiceSyncJob();
    }
  }

  async function onMessageRequestResponse(ev: WhatIsThis) {
    ev.confirm();

    const {
      threadE164,
      threadUuid,
      groupId,
      groupV2Id,
      messageRequestResponseType,
    } = ev;

    window.log.info('onMessageRequestResponse', {
      threadE164,
      threadUuid,
      groupId: `group(${groupId})`,
      groupV2Id: `groupv2(${groupV2Id})`,
      messageRequestResponseType,
    });

    const sync = window.Whisper.MessageRequests.add({
      threadE164,
      threadUuid,
      groupId,
      groupV2Id,
      type: messageRequestResponseType,
    });

    window.Whisper.MessageRequests.onResponse(sync);
  }

  function onReadReceipt(ev: WhatIsThis) {
    const readAt = ev.timestamp;
    const { envelopeTimestamp, timestamp, source, sourceUuid } = ev.read;
    const reader = window.ConversationController.ensureContactIds({
      e164: source,
      uuid: sourceUuid,
      highTrust: true,
    });
    window.log.info(
      'read receipt',
      source,
      sourceUuid,
      envelopeTimestamp,
      reader,
      'for sent message',
      timestamp
    );

    ev.confirm();

    if (!window.storage.get('read-receipt-setting') || !reader) {
      return;
    }

    const receipt = window.Whisper.ReadReceipts.add({
      reader,
      timestamp,
      read_at: readAt,
    });

    // Note: We do not wait for completion here
    window.Whisper.ReadReceipts.onReceipt(receipt);
  }

  function onReadSync(ev: WhatIsThis) {
    const readAt = ev.timestamp;
    const { envelopeTimestamp, sender, senderUuid, timestamp } = ev.read;
    const senderId = window.ConversationController.ensureContactIds({
      e164: sender,
      uuid: senderUuid,
    });

    window.log.info(
      'read sync',
      sender,
      senderUuid,
      envelopeTimestamp,
      senderId,
      'for message',
      timestamp
    );

    const receipt = window.Whisper.ReadSyncs.add({
      senderId,
      sender,
      senderUuid,
      timestamp,
      read_at: readAt,
    });

    receipt.on('remove', ev.confirm);

    // Note: Here we wait, because we want read states to be in the database
    //   before we move on.
    return window.Whisper.ReadSyncs.onReceipt(receipt);
  }

  async function onVerified(ev: WhatIsThis) {
    const e164 = ev.verified.destination;
    const uuid = ev.verified.destinationUuid;
    const key = ev.verified.identityKey;
    let state;

    if (ev.confirm) {
      ev.confirm();
    }

    const c = new window.Whisper.Conversation({
      e164,
      uuid,
      type: 'private',
    } as WhatIsThis);
    const error = c.validate();
    if (error) {
      window.log.error(
        'Invalid verified sync received:',
        e164,
        uuid,
        Errors.toLogFormat(error as WhatIsThis)
      );
      return;
    }

    switch (ev.verified.state) {
      case window.textsecure.protobuf.Verified.State.DEFAULT:
        state = 'DEFAULT';
        break;
      case window.textsecure.protobuf.Verified.State.VERIFIED:
        state = 'VERIFIED';
        break;
      case window.textsecure.protobuf.Verified.State.UNVERIFIED:
        state = 'UNVERIFIED';
        break;
      default:
        window.log.error(`Got unexpected verified state: ${ev.verified.state}`);
    }

    window.log.info(
      'got verified sync for',
      e164,
      uuid,
      state,
      ev.viaContactSync ? 'via contact sync' : ''
    );

    const verifiedId = window.ConversationController.ensureContactIds({
      e164,
      uuid,
      highTrust: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contact = window.ConversationController.get(verifiedId)!;
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
  }

  function onDeliveryReceipt(ev: WhatIsThis) {
    const { deliveryReceipt } = ev;
    const {
      envelopeTimestamp,
      sourceUuid,
      source,
      sourceDevice,
      timestamp,
    } = deliveryReceipt;

    ev.confirm();

    const deliveredTo = window.ConversationController.ensureContactIds({
      e164: source,
      uuid: sourceUuid,
      highTrust: true,
    });

    window.log.info(
      'delivery receipt from',
      source,
      sourceUuid,
      sourceDevice,
      deliveredTo,
      envelopeTimestamp,
      'for sent message',
      timestamp
    );

    if (!deliveredTo) {
      window.log.info('no conversation for', source, sourceUuid);
      return;
    }

    const receipt = window.Whisper.DeliveryReceipts.add({
      timestamp,
      deliveredTo,
    });

    // Note: We don't wait for completion here
    window.Whisper.DeliveryReceipts.onReceipt(receipt);
  }
}

window.startApp = startApp;
