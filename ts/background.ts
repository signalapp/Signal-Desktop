// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, noop } from 'lodash';
import { bindActionCreators } from 'redux';
import { render } from 'react-dom';

import MessageReceiver from './textsecure/MessageReceiver';
import { SessionResetsType, ProcessedDataMessage } from './textsecure/Types.d';
import {
  MessageAttributesType,
  ConversationAttributesType,
} from './model-types.d';
import * as Bytes from './Bytes';
import { typedArrayToArrayBuffer } from './Crypto';
import { WhatIsThis, DeliveryReceiptBatcherItemType } from './window.d';
import { getTitleBarVisibility, TitleBarVisibility } from './types/Settings';
import { SocketStatus } from './types/SocketStatus';
import { DEFAULT_CONVERSATION_COLOR } from './types/Colors';
import { ChallengeHandler } from './challenge';
import { isWindowDragElement } from './util/isWindowDragElement';
import { assert, strictAssert } from './util/assert';
import { dropNull } from './util/dropNull';
import { normalizeUuid } from './util/normalizeUuid';
import { filter } from './util/iterables';
import { isNotNil } from './util/isNotNil';
import { senderCertificateService } from './services/senderCertificate';
import { routineProfileRefresh } from './routineProfileRefresh';
import { isMoreRecentThan, isOlderThan } from './util/timestamp';
import { isValidReactionEmoji } from './reactions/isValidReactionEmoji';
import { ConversationModel } from './models/conversations';
import { getMessageById } from './models/messages';
import { createBatcher } from './util/batcher';
import { updateConversationsWithUuidLookup } from './updateConversationsWithUuidLookup';
import { initializeAllJobQueues } from './jobs/initializeAllJobQueues';
import { removeStorageKeyJobQueue } from './jobs/removeStorageKeyJobQueue';
import { ourProfileKeyService } from './services/ourProfileKey';
import { shouldRespondWithProfileKey } from './util/shouldRespondWithProfileKey';
import { LatestQueue } from './util/LatestQueue';
import { parseIntOrThrow } from './util/parseIntOrThrow';
import {
  TypingEvent,
  ErrorEvent,
  DeliveryEvent,
  SentEvent,
  SentEventData,
  ProfileKeyUpdateEvent,
  MessageEvent,
  MessageEventData,
  ReadEvent,
  ConfigurationEvent,
  ViewSyncEvent,
  MessageRequestResponseEvent,
  FetchLatestEvent,
  KeysEvent,
  StickerPackEvent,
  VerifiedEvent,
  ReadSyncEvent,
  ContactEvent,
  GroupEvent,
} from './textsecure/messageReceiverEvents';
import { connectToServerWithStoredCredentials } from './util/connectToServerWithStoredCredentials';
import * as universalExpireTimer from './util/universalExpireTimer';
import { isDirectConversation, isGroupV2 } from './util/whatTypeOfConversation';
import { getSendOptions } from './util/getSendOptions';
import { BackOff, FIBONACCI_TIMEOUTS } from './util/BackOff';
import { handleMessageSend } from './util/handleMessageSend';
import { AppViewType } from './state/ducks/app';
import { isIncoming } from './state/selectors/message';
import { actionCreators } from './state/actions';
import { Deletes } from './messageModifiers/Deletes';
import {
  MessageReceipts,
  MessageReceiptType,
} from './messageModifiers/MessageReceipts';
import { MessageRequests } from './messageModifiers/MessageRequests';
import { Reactions } from './messageModifiers/Reactions';
import { ReadSyncs } from './messageModifiers/ReadSyncs';
import { ViewSyncs } from './messageModifiers/ViewSyncs';
import {
  SendStateByConversationId,
  SendStatus,
} from './messages/MessageSendState';
import * as AttachmentDownloads from './messageModifiers/AttachmentDownloads';
import {
  SystemTraySetting,
  parseSystemTraySetting,
} from './types/SystemTraySetting';
import * as Stickers from './types/Stickers';
import { SignalService as Proto } from './protobuf';
import { onRetryRequest, onDecryptionError } from './util/handleRetry';

const MAX_ATTACHMENT_DOWNLOAD_AGE = 3600 * 72 * 1000;

export function isOverHourIntoPast(timestamp: number): boolean {
  const HOUR = 1000 * 60 * 60;
  return isNumber(timestamp) && isOlderThan(timestamp, HOUR);
}

export async function cleanupSessionResets(): Promise<void> {
  const sessionResets = window.storage.get(
    'sessionResets',
    <SessionResetsType>{}
  );

  const keys = Object.keys(sessionResets);
  keys.forEach(key => {
    const timestamp = sessionResets[key];
    if (!timestamp || isOverHourIntoPast(timestamp)) {
      delete sessionResets[key];
    }
  });

  await window.storage.put('sessionResets', sessionResets);
}

export async function startApp(): Promise<void> {
  window.Whisper.events = window._.clone(window.Backbone.Events);
  window.Signal.Util.MessageController.install();
  window.Signal.conversationControllerStart();
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

  initializeAllJobQueues();

  ourProfileKeyService.initialize(window.storage);

  window.storage.onready(() => {
    if (!window.storage.get('defaultConversationColor')) {
      window.storage.put(
        'defaultConversationColor',
        DEFAULT_CONVERSATION_COLOR
      );
    }
  });

  let resolveOnAppView: (() => void) | undefined;
  const onAppView = new Promise<void>(resolve => {
    resolveOnAppView = resolve;
  });

  const reconnectBackOff = new BackOff(FIBONACCI_TIMEOUTS);

  window.storage.onready(() => {
    senderCertificateService.initialize({
      WebAPI: window.WebAPI,
      navigator,
      onlineEventTarget: window,
      storage: window.storage,
    });
  });

  const eventHandlerQueue = new window.PQueue({
    concurrency: 1,
    timeout: 1000 * 60 * 2,
  });

  const profileKeyResponseQueue = new window.PQueue();
  profileKeyResponseQueue.pause();

  const lightSessionResetQueue = new window.PQueue();
  window.Signal.Services.lightSessionResetQueue = lightSessionResetQueue;
  lightSessionResetQueue.pause();

  window.Whisper.deliveryReceiptQueue = new window.PQueue({
    concurrency: 1,
    timeout: 1000 * 60 * 2,
  });
  window.Whisper.deliveryReceiptQueue.pause();
  window.Whisper.deliveryReceiptBatcher = window.Signal.Util.createBatcher<DeliveryReceiptBatcherItemType>(
    {
      name: 'Whisper.deliveryReceiptBatcher',
      wait: 500,
      maxSize: 500,
      processBatch: async items => {
        const byConversationId = window._.groupBy(items, item =>
          window.ConversationController.ensureContactIds({
            e164: item.source,
            uuid: item.sourceUuid,
          })
        );
        const ids = Object.keys(byConversationId);

        for (let i = 0, max = ids.length; i < max; i += 1) {
          const conversationId = ids[i];
          const ourItems = byConversationId[conversationId];
          const timestamps = ourItems.map(item => item.timestamp);
          const messageIds = ourItems.map(item => item.messageId);

          const c = window.ConversationController.get(conversationId);
          if (!c) {
            window.log.warn(
              `deliveryReceiptBatcher: Conversation ${conversationId} does not exist! ` +
                `Will not send delivery receipts for timestamps ${timestamps}`
            );
            continue;
          }

          const uuid = c.get('uuid');
          const e164 = c.get('e164');

          c.queueJob('sendDeliveryReceipt', async () => {
            try {
              const sendOptions = await getSendOptions(c.attributes);

              // eslint-disable-next-line no-await-in-loop
              await handleMessageSend(
                window.textsecure.messaging.sendDeliveryReceipt({
                  e164,
                  uuid,
                  timestamps,
                  options: sendOptions,
                }),
                { messageIds, sendType: 'deliveryReceipt' }
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
    }
  );

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
      userChanged({ interactionMode });
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
      userChanged({ interactionMode });
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
  function preload(list: ReadonlyArray<string>) {
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
  let newVersion = false;

  window.document.title = window.getTitle();

  window.Whisper.KeyChangeListener.init(window.textsecure.storage.protocol);
  window.textsecure.storage.protocol.on('removePreKey', () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.getAccountManager()!.refreshPreKeys();
  });

  let messageReceiver: MessageReceiver | undefined;
  let preMessageReceiverStatus: SocketStatus | undefined;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    if (preMessageReceiverStatus) {
      return preMessageReceiverStatus;
    }
    return SocketStatus.CLOSED;
  };
  let accountManager: typeof window.textsecure.AccountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const OLD_USERNAME = window.storage.get('number_id', '');
      const USERNAME = window.storage.get('uuid_id', '');
      const PASSWORD = window.storage.get('password', '');
      accountManager = new window.textsecure.AccountManager(
        USERNAME || OLD_USERNAME,
        PASSWORD
      );
      accountManager.addEventListener('registration', () => {
        const ourDeviceId = window.textsecure.storage.user.getDeviceId();
        const ourNumber = window.textsecure.storage.user.getNumber();
        const ourUuid = window.textsecure.storage.user.getUuid();
        const user = {
          ourConversationId: window.ConversationController.getOurConversationId(),
          ourDeviceId,
          ourNumber,
          ourUuid,
          regionCode: window.storage.get('regionCode'),
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

  function mapOldThemeToNew(theme: Readonly<unknown>) {
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

    cleanupSessionResets();

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => window.textsecure.storage.user.getDeviceName(),

      getThemeSetting: (): 'light' | 'dark' | 'system' =>
        window.storage.get(
          'theme-setting',
          window.platform === 'darwin' ? 'system' : 'light'
        ),
      setThemeSetting: (value: 'light' | 'dark' | 'system') => {
        window.storage.put('theme-setting', value);
        onChangeTheme();
      },
      getHideMenuBar: () => window.storage.get('hide-menu-bar'),
      setHideMenuBar: (value: boolean) => {
        window.storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },
      getSystemTraySetting: (): SystemTraySetting =>
        parseSystemTraySetting(window.storage.get('system-tray-setting')),
      setSystemTraySetting: (value: Readonly<SystemTraySetting>) => {
        window.storage.put('system-tray-setting', value);
        window.updateSystemTraySetting(value);
      },

      getNotificationSetting: () =>
        window.storage.get('notification-setting', 'message'),
      setNotificationSetting: (value: 'message' | 'name' | 'count' | 'off') =>
        window.storage.put('notification-setting', value),
      getNotificationDrawAttention: () =>
        window.storage.get('notification-draw-attention', true),
      setNotificationDrawAttention: (value: boolean) =>
        window.storage.put('notification-draw-attention', value),
      getAudioNotification: () => window.storage.get('audio-notification'),
      setAudioNotification: (value: boolean) =>
        window.storage.put('audio-notification', value),
      getCountMutedConversations: () =>
        window.storage.get('badge-count-muted-conversations', false),
      setCountMutedConversations: (value: boolean) => {
        window.storage.put('badge-count-muted-conversations', value);
        window.Whisper.events.trigger('updateUnreadCount');
      },
      getCallRingtoneNotification: () =>
        window.storage.get('call-ringtone-notification', true),
      setCallRingtoneNotification: (value: boolean) =>
        window.storage.put('call-ringtone-notification', value),
      getCallSystemNotification: () =>
        window.storage.get('call-system-notification', true),
      setCallSystemNotification: (value: boolean) =>
        window.storage.put('call-system-notification', value),
      getIncomingCallNotification: () =>
        window.storage.get('incoming-call-notification', true),
      setIncomingCallNotification: (value: boolean) =>
        window.storage.put('incoming-call-notification', value),

      getSpellCheck: () => window.storage.get('spell-check', true),
      setSpellCheck: (value: boolean) => {
        window.storage.put('spell-check', value);
      },

      getAlwaysRelayCalls: () => window.storage.get('always-relay-calls'),
      setAlwaysRelayCalls: (value: boolean) =>
        window.storage.put('always-relay-calls', value),

      getAutoLaunch: () => window.getAutoLaunch(),
      setAutoLaunch: (value: boolean) => window.setAutoLaunch(value),

      isPrimary: () => window.textsecure.storage.user.getDeviceId() === 1,
      getSyncRequest: () =>
        new Promise<void>((resolve, reject) => {
          const FIVE_MINUTES = 5 * 60 * 60 * 1000;
          const syncRequest = window.getSyncRequest(FIVE_MINUTES);
          syncRequest.addEventListener('success', () => resolve());
          syncRequest.addEventListener('timeout', () =>
            reject(new Error('timeout'))
          );
        }),
      getLastSyncTime: () => window.storage.get('synced_at'),
      setLastSyncTime: (value: number) =>
        window.storage.put('synced_at', value),
      getUniversalExpireTimer: (): number | undefined => {
        return universalExpireTimer.get();
      },
      setUniversalExpireTimer: async (
        newValue: number | undefined
      ): Promise<void> => {
        await universalExpireTimer.set(newValue);

        // Update account in Storage Service
        const conversationId = window.ConversationController.getOurConversationIdOrThrow();
        const account = window.ConversationController.get(conversationId);
        assert(account, "Account wasn't found");

        account.captureChange('universalExpireTimer');

        // Add a notification to the currently open conversation
        const state = window.reduxStore.getState();
        const selectedId = state.conversations.selectedConversationId;
        if (selectedId) {
          const conversation = window.ConversationController.get(selectedId);
          assert(conversation, "Conversation wasn't found");

          conversation.queueJob('maybeSetPendingUniversalTimer', () =>
            conversation.maybeSetPendingUniversalTimer()
          );
        }
      },

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),
      showKeyboardShortcuts: () => window.showKeyboardShortcuts(),

      deleteAllData: async () => {
        await window.sqlInitializer.goBackToMainProcess();

        const clearDataView = new window.Whisper.ClearDataView().render();
        $('body').append(clearDataView.el);
      },

      shutdown: async () => {
        window.log.info('background/shutdown');
        // Stop background processing
        AttachmentDownloads.stop();
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
          messageReceiver = undefined;
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
          Stickers.downloadEphemeralPack(packId, key);

          const props = {
            packId,
            onClose: async () => {
              window.isShowingModal = false;
              stickerPreviewModalView.remove();
              await Stickers.removeEphemeralPack(packId);
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
        Stickers.downloadStickerPack(packId, key, {
          finalStatus: 'installed',
        });
      },
    };

    // How long since we were last running?
    const lastHeartbeat = window.storage.get('lastHeartbeat', 0);
    const previousLastStartup = window.storage.get('lastStartup');
    await window.storage.put('lastStartup', Date.now());

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (lastHeartbeat > 0 && isOlderThan(lastHeartbeat, THIRTY_DAYS)) {
      window.log.warn(
        `This instance has not been used for 30 days. Last heartbeat: ${lastHeartbeat}. Last startup: ${previousLastStartup}.`
      );
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

      if (window.isBeforeVersion(lastVersion, 'v5.2.0')) {
        const legacySenderCertificateStorageKey = 'senderCertificateWithUuid';
        await removeStorageKeyJobQueue.add({
          key: legacySenderCertificateStorageKey,
        });
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

    // We start this up before window.ConversationController.load() to
    // ensure that our feature flags are represented in the cached props
    // we generate on load of each convo.
    window.Signal.RemoteConfig.initRemoteConfig();

    let retryReceiptLifespan: number | undefined;
    try {
      retryReceiptLifespan = parseIntOrThrow(
        window.Signal.RemoteConfig.getValue('desktop.retryReceiptLifespan'),
        'retryReceiptLifeSpan'
      );
    } catch (error) {
      window.log.warn(
        'Failed to parse integer out of desktop.retryReceiptLifespan feature flag',
        error && error.stack ? error.stack : error
      );
    }

    const retryPlaceholders = new window.Signal.Util.RetryPlaceholders({
      retryReceiptLifespan,
    });
    window.Signal.Services.retryPlaceholders = retryPlaceholders;

    setInterval(async () => {
      const now = Date.now();
      const HOUR = 1000 * 60 * 60;
      const DAY = 24 * HOUR;
      const oneDayAgo = now - DAY;
      try {
        await window.Signal.Data.deleteSentProtosOlderThan(oneDayAgo);
      } catch (error) {
        window.log.error(
          'background/onready/setInterval: Error deleting sent protos: ',
          error && error.stack ? error.stack : error
        );
      }

      try {
        const expired = await retryPlaceholders.getExpiredAndRemove();
        window.log.info(
          `retryPlaceholders/interval: Found ${expired.length} expired items`
        );
        expired.forEach(item => {
          const { conversationId, senderUuid } = item;
          const conversation = window.ConversationController.get(
            conversationId
          );
          if (conversation) {
            const receivedAt = Date.now();
            const receivedAtCounter = window.Signal.Util.incrementMessageCounter();
            conversation.queueJob('addDeliveryIssue', () =>
              conversation.addDeliveryIssue({
                receivedAt,
                receivedAtCounter,
                senderUuid,
              })
            );
          }
        });
      } catch (error) {
        window.log.error(
          'background/onready/setInterval: Error getting expired retry placeholders: ',
          error && error.stack ? error.stack : error
        );
      }
    }, FIVE_MINUTES);

    try {
      await Promise.all([
        window.ConversationController.load(),
        Stickers.load(),
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

    const themeSetting = window.Events.getThemeSetting();
    const theme = themeSetting === 'system' ? window.systemTheme : themeSetting;

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
      stickers: Stickers.getInitialState(),
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
        theme,
      },
    };

    const store = window.Signal.State.createStore(initialState);
    window.reduxStore = store;

    // Binding these actions to our redux store and exposing them allows us to update
    //   redux when things change in the backbone world.
    window.reduxActions = {
      accounts: bindActionCreators(actionCreators.accounts, store.dispatch),
      app: bindActionCreators(actionCreators.app, store.dispatch),
      audioPlayer: bindActionCreators(
        actionCreators.audioPlayer,
        store.dispatch
      ),
      calling: bindActionCreators(actionCreators.calling, store.dispatch),
      composer: bindActionCreators(actionCreators.composer, store.dispatch),
      conversations: bindActionCreators(
        actionCreators.conversations,
        store.dispatch
      ),
      emojis: bindActionCreators(actionCreators.emojis, store.dispatch),
      expiration: bindActionCreators(actionCreators.expiration, store.dispatch),
      globalModals: bindActionCreators(
        actionCreators.globalModals,
        store.dispatch
      ),
      items: bindActionCreators(actionCreators.items, store.dispatch),
      linkPreviews: bindActionCreators(
        actionCreators.linkPreviews,
        store.dispatch
      ),
      network: bindActionCreators(actionCreators.network, store.dispatch),
      safetyNumber: bindActionCreators(
        actionCreators.safetyNumber,
        store.dispatch
      ),
      search: bindActionCreators(actionCreators.search, store.dispatch),
      stickers: bindActionCreators(actionCreators.stickers, store.dispatch),
      updates: bindActionCreators(actionCreators.updates, store.dispatch),
      user: bindActionCreators(actionCreators.user, store.dispatch),
    };

    const {
      conversationAdded,
      conversationChanged,
      conversationRemoved,
      removeAllConversations,
    } = window.reduxActions.conversations;
    const { userChanged } = window.reduxActions.user;

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

    const changedConvoBatcher = createBatcher<ConversationModel>({
      name: 'changedConvoBatcher',
      processBatch(batch) {
        const deduped = new Set(batch);
        window.log.info(
          'changedConvoBatcher: deduped ' +
            `${batch.length} into ${deduped.size}`
        );

        deduped.forEach(conversation => {
          conversationChanged(conversation.id, conversation.format());
        });
      },

      // This delay ensures that the .format() call isn't synchronous as a
      //   Backbone property is changed. Important because our _byUuid/_byE164
      //   lookups aren't up-to-date as the change happens; just a little bit
      //   after.
      wait: 1,
      maxSize: Infinity,
    });

    convoCollection.on('change', conversation => {
      if (!conversation) {
        return;
      }

      changedConvoBatcher.add(conversation);
    });
    convoCollection.on('reset', removeAllConversations);

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
          document.querySelector(
            '.module-conversation-list__item--contact-or-conversation'
          ),
          document.querySelector('.module-search-results'),
          document.querySelector('.CompositionArea .ql-editor'),
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
          '.module-ConversationHeader__button--more'
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
    window.reduxActions.app.openInstaller();
  });

  window.Whisper.events.on('setupAsStandalone', () => {
    window.reduxActions.app.openStandalone();
  });

  window.Whisper.events.on('powerMonitorSuspend', () => {
    window.log.info('powerMonitor: suspend');
  });

  window.Whisper.events.on('powerMonitorResume', () => {
    window.log.info('powerMonitor: resume');
    if (!messageReceiver) {
      return;
    }

    messageReceiver.checkSocket();
  });

  const reconnectToWebSocketQueue = new LatestQueue();

  const enqueueReconnectToWebSocket = () => {
    reconnectToWebSocketQueue.add(async () => {
      if (!messageReceiver) {
        window.log.info(
          'reconnectToWebSocket: No messageReceiver. Early return.'
        );
        return;
      }

      window.log.info('reconnectToWebSocket starting...');
      await disconnect();
      connect();
      window.log.info('reconnectToWebSocket complete.');
    });
  };

  window.Whisper.events.on(
    'mightBeUnlinked',
    window._.debounce(enqueueReconnectToWebSocket, 1000, { maxWait: 5000 })
  );

  function runStorageService() {
    window.Signal.Services.enableStorageService();

    if (window.ConversationController.areWePrimaryDevice()) {
      window.log.warn(
        'background/runStorageService: We are primary device; not sending key sync request'
      );
      return;
    }

    handleMessageSend(window.textsecure.messaging.sendRequestKeySyncMessage(), {
      messageIds: [],
      sendType: 'otherSync',
    });
  }

  let challengeHandler: ChallengeHandler | undefined;

  async function start() {
    challengeHandler = new ChallengeHandler({
      storage: window.storage,

      getMessageById,

      requestChallenge(request) {
        window.sendChallengeRequest(request);
      },

      async sendChallengeResponse(data) {
        await window.textsecure.messaging.sendChallengeResponse(data);
      },

      onChallengeFailed() {
        // TODO: DESKTOP-1530
        // Display humanized `retryAfter`
        window.Whisper.ToastView.show(
          window.Whisper.CaptchaFailedToast,
          document.getElementsByClassName('conversation-stack')[0] ||
            document.body
        );
      },

      onChallengeSolved() {
        window.Whisper.ToastView.show(
          window.Whisper.CaptchaSolvedToast,
          document.getElementsByClassName('conversation-stack')[0] ||
            document.body
        );
      },

      setChallengeStatus(challengeStatus) {
        window.reduxActions.network.setChallengeStatus(challengeStatus);
      },
    });
    window.Whisper.events.on('challengeResponse', response => {
      if (!challengeHandler) {
        throw new Error('Expected challenge handler to be there');
      }

      challengeHandler.onResponse(response);
    });

    window.storage.onready(async () => {
      if (!challengeHandler) {
        throw new Error('Expected challenge handler to be there');
      }

      await challengeHandler.load();
    });

    window.Signal.challengeHandler = challengeHandler;

    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Expiration start timestamp cleanup: starting...');
    const messagesUnexpectedlyMissingExpirationStartTimestamp = await window.Signal.Data.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
    window.log.info(
      `Expiration start timestamp cleanup: Found ${messagesUnexpectedlyMissingExpirationStartTimestamp.length} messages for cleanup`
    );
    if (messagesUnexpectedlyMissingExpirationStartTimestamp.length) {
      const newMessageAttributes = messagesUnexpectedlyMissingExpirationStartTimestamp.map(
        message => {
          const expirationStartTimestamp = Math.min(
            ...filter(
              [
                // These messages should always have a sent_at, but we have fallbacks
                //   just in case.
                message.sent_at,
                Date.now(),
                // The query shouldn't return messages with expiration start timestamps,
                //   but we're trying to be extra careful.
                message.expirationStartTimestamp,
              ],
              isNotNil
            )
          );
          window.log.info(
            `Expiration start timestamp cleanup: starting timer for ${message.type} message sent at ${message.sent_at}. Starting timer at ${message.expirationStartTimestamp}`
          );
          return {
            ...message,
            expirationStartTimestamp,
          };
        }
      );

      await window.Signal.Data.saveMessages(newMessageAttributes);
    }
    window.log.info('Expiration start timestamp cleanup: complete');

    window.log.info('listening for registration events');
    window.Whisper.events.on('registration_done', () => {
      window.log.info('handling registration event');
      connect(true);
    });

    cancelInitializationMessage();
    render(
      window.Signal.State.Roots.createApp(window.reduxStore),
      document.getElementById('app-container')
    );
    const hideMenuBar = window.storage.get('hide-menu-bar', false);
    window.setAutoHideMenuBar(hideMenuBar);
    window.setMenuBarVisibility(!hideMenuBar);

    window.Whisper.WallClockListener.init(window.Whisper.events);
    window.Whisper.ExpiringMessagesListener.init(window.Whisper.events);
    window.Whisper.TapToViewMessagesListener.init(window.Whisper.events);

    if (window.Signal.Util.Registration.everDone()) {
      connect();
      window.reduxActions.app.openInbox();
    } else {
      window.reduxActions.app.openInstaller();
    }

    window.Whisper.events.on('contactsync', () => {
      if (window.reduxStore.getState().app.appView === AppViewType.Installer) {
        window.reduxActions.app.openInbox();
      }
    });

    window.registerForActive(() => window.Whisper.Notifications.clear());
    window.addEventListener('unload', () =>
      window.Whisper.Notifications.fastClear()
    );

    window.Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        window.Whisper.events.trigger('showConversation', id, messageId);
      } else {
        window.reduxActions.app.openInbox();
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

        if (window.ConversationController.areWePrimaryDevice()) {
          window.log.warn(
            'onChange/desktop.storage: We are primary device; not sending key sync request'
          );
          return;
        }

        await handleMessageSend(
          window.textsecure.messaging.sendRequestKeySyncMessage(),
          { messageIds: [], sendType: 'otherSync' }
        );
      }
    );

    if (resolveOnAppView) {
      resolveOnAppView();
      resolveOnAppView = undefined;
    }
  }

  window.getSyncRequest = (timeoutMillis?: number) => {
    strictAssert(messageReceiver, 'MessageReceiver not initialized');

    const syncRequest = new window.textsecure.SyncRequest(
      window.textsecure.messaging,
      messageReceiver,
      timeoutMillis
    );
    syncRequest.start();
    return syncRequest;
  };

  let disconnectTimer: NodeJS.Timeout | undefined;
  let reconnectTimer: number | undefined;
  function onOffline() {
    window.log.info('offline');

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);

    if (challengeHandler) {
      challengeHandler.onOffline();
    }
  }

  function onOnline() {
    window.log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
      window.log.warn('Already online. Had a blip in online/offline status.');
      clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
      return;
    }
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
    }

    connect();
  }

  function isSocketOnline() {
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === SocketStatus.CONNECTING ||
      socketStatus === SocketStatus.OPEN
    );
  }

  async function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = undefined;

    AttachmentDownloads.stop();
    if (messageReceiver) {
      await messageReceiver.close();
    }
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
        reconnectTimer = undefined;
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

      preMessageReceiverStatus = SocketStatus.CONNECTING;

      if (messageReceiver) {
        await messageReceiver.stopProcessing();

        await window.waitForAllBatchers();
      }

      if (messageReceiver) {
        messageReceiver.unregisterBatchers();
        messageReceiver = undefined;
      }

      const OLD_USERNAME = window.storage.get('number_id', '');
      const USERNAME = window.storage.get('uuid_id', '');
      const PASSWORD = window.storage.get('password', '');

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
          const lonelyE164Conversations = window
            .getConversations()
            .filter(c =>
              Boolean(
                isDirectConversation(c.attributes) &&
                  c.get('e164') &&
                  !c.get('uuid') &&
                  !c.isEverUnregistered()
              )
            );
          await updateConversationsWithUuidLookup({
            conversationController: window.ConversationController,
            conversations: lonelyE164Conversations,
            messaging: window.textsecure.messaging,
          });
        } catch (error) {
          window.log.error(
            'connect: Error fetching UUIDs for lonely e164s:',
            error && error.stack ? error.stack : error
          );
        }
      }

      connectCount += 1;

      // To avoid a flood of operations before we catch up, we pause some queues.
      profileKeyResponseQueue.pause();
      lightSessionResetQueue.pause();
      window.Whisper.deliveryReceiptQueue.pause();
      window.Whisper.Notifications.disable();

      // initialize the socket and start listening for messages
      window.log.info('Initializing socket and listening for messages');
      const messageReceiverOptions = {
        serverTrustRoot: window.getServerTrustRoot(),
      };
      messageReceiver = new window.textsecure.MessageReceiver(
        OLD_USERNAME,
        USERNAME,
        PASSWORD,
        messageReceiverOptions
      );
      window.textsecure.messageReceiver = messageReceiver;

      window.Signal.Services.initializeGroupCredentialFetcher();

      preMessageReceiverStatus = undefined;

      // eslint-disable-next-line no-inner-declarations
      function queuedEventListener<Args extends Array<unknown>>(
        handler: (...args: Args) => Promise<void> | void,
        track = true
      ): (...args: Args) => void {
        return (...args: Args): void => {
          eventHandlerQueue.add(async () => {
            try {
              await handler(...args);
            } finally {
              // message/sent: Message.handleDataMessage has its own queue and will
              //   trigger this event itself when complete.
              // error: Error processing (below) also has its own queue and self-trigger.
              if (track) {
                window.Whisper.events.trigger('incrementProgress');
              }
            }
          });
        };
      }

      messageReceiver.addEventListener(
        'message',
        queuedEventListener(onMessageReceived, false)
      );
      messageReceiver.addEventListener(
        'delivery',
        queuedEventListener(onDeliveryReceipt)
      );
      messageReceiver.addEventListener(
        'contact',
        queuedEventListener(onContactReceived)
      );
      messageReceiver.addEventListener(
        'contactSync',
        queuedEventListener(onContactSyncComplete)
      );
      messageReceiver.addEventListener(
        'group',
        queuedEventListener(onGroupReceived)
      );
      messageReceiver.addEventListener(
        'groupSync',
        queuedEventListener(onGroupSyncComplete)
      );
      messageReceiver.addEventListener(
        'sent',
        queuedEventListener(onSentMessage, false)
      );
      messageReceiver.addEventListener(
        'readSync',
        queuedEventListener(onReadSync)
      );
      messageReceiver.addEventListener(
        'read',
        queuedEventListener(onReadReceipt)
      );
      messageReceiver.addEventListener(
        'verified',
        queuedEventListener(onVerified)
      );
      messageReceiver.addEventListener(
        'error',
        queuedEventListener(onError, false)
      );
      messageReceiver.addEventListener(
        'decryption-error',
        queuedEventListener(onDecryptionError)
      );
      messageReceiver.addEventListener(
        'retry-request',
        queuedEventListener(onRetryRequest)
      );
      messageReceiver.addEventListener('empty', queuedEventListener(onEmpty));
      messageReceiver.addEventListener(
        'reconnect',
        queuedEventListener(onReconnect)
      );
      messageReceiver.addEventListener(
        'configuration',
        queuedEventListener(onConfiguration)
      );
      messageReceiver.addEventListener('typing', queuedEventListener(onTyping));
      messageReceiver.addEventListener(
        'sticker-pack',
        queuedEventListener(onStickerPack)
      );
      messageReceiver.addEventListener(
        'viewSync',
        queuedEventListener(onViewSync)
      );
      messageReceiver.addEventListener(
        'messageRequestResponse',
        queuedEventListener(onMessageRequestResponse)
      );
      messageReceiver.addEventListener(
        'profileKeyUpdate',
        queuedEventListener(onProfileKeyUpdate)
      );
      messageReceiver.addEventListener(
        'fetchLatest',
        queuedEventListener(onFetchLatestSync)
      );
      messageReceiver.addEventListener('keys', queuedEventListener(onKeysSync));

      AttachmentDownloads.start({
        getMessageReceiver: () => messageReceiver,
        logger: window.log,
      });

      if (connectCount === 1) {
        Stickers.downloadQueuedPacks();
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
        window.textsecure.storage.user.getDeviceId() !== 1
      ) {
        window.log.info('Boot after upgrading. Requesting contact sync');
        window.getSyncRequest();

        runStorageService();

        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const manager = window.getAccountManager()!;
          await Promise.all([
            manager.maybeUpdateDeviceName(),
            window.textsecure.storage.user.removeSignalingKey(),
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
        const server = connectToServerWithStoredCredentials(
          window.WebAPI,
          window.storage
        );
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
          assert(deviceId, 'We should have device id');
          window.textsecure.storage.user.setUuidAndDeviceId(uuid, deviceId);
          const ourNumber = window.textsecure.storage.user.getNumber();

          assert(ourNumber, 'We should have number');
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
        const server = connectToServerWithStoredCredentials(
          window.WebAPI,
          window.storage
        );
        try {
          // Note: we always have to register our capabilities all at once, so we do this
          //   after connect on every startup
          await server.registerCapabilities({
            announcementGroup: true,
            'gv2-3': true,
            'gv1-migration': true,
            senderKey: window.Signal.RemoteConfig.isEnabled(
              'desktop.sendSenderKey2'
            ),
          });
        } catch (error) {
          window.log.error(
            'Error: Unable to register our capabilities.',
            error && error.stack ? error.stack : error
          );
        }
      }

      if (firstRun === true && deviceId !== 1) {
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
        const syncRequest = window.getSyncRequest();
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

        const ourConversation = window.ConversationController.getOurConversationOrThrow();
        const sendOptions = await getSendOptions(ourConversation.attributes, {
          syncMessage: true,
        });

        const installedStickerPacks = Stickers.getInstalledStickerPacks();
        if (installedStickerPacks.length) {
          const operations = installedStickerPacks.map(pack => ({
            packId: pack.id,
            packKey: pack.key,
            installed: true,
          }));

          if (window.ConversationController.areWePrimaryDevice()) {
            window.log.warn(
              'background/connect: We are primary device; not sending sticker pack sync'
            );
            return;
          }

          handleMessageSend(
            window.textsecure.messaging.sendStickerPackSync(
              operations,
              sendOptions
            ),
            { messageIds: [], sendType: 'otherSync' }
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

      if (!challengeHandler) {
        throw new Error('Expected challenge handler to be initialized');
      }

      // Intentionally not awaiting
      challengeHandler.onOnline();

      reconnectBackOff.reset();
    } finally {
      connecting = false;
    }
  }

  function onChangeTheme() {
    if (window.reduxActions && window.reduxActions.user) {
      const theme = window.Events.getThemeSetting();
      window.reduxActions.user.userChanged({
        theme: theme === 'system' ? window.systemTheme : theme,
      });
    }
  }

  window.SignalContext.nativeThemeListener.subscribe(() => {
    onChangeTheme();
  });

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
      let resolve: undefined | (() => void);
      let reject: undefined | ((error: Error) => void);
      const promise = new Promise<void>((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });

      const timeout = reject && setTimeout(reject, FIVE_MINUTES);
      const onEmptyOnce = () => {
        if (messageReceiver) {
          messageReceiver.removeEventListener('empty', onEmptyOnce);
        }
        clearTimeout(timeout);
        if (resolve) {
          resolve();
        }
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
    window.readyForUpdates();

    // Start listeners here, after we get through our queue.
    window.Whisper.RotateSignedPreKeyListener.init(
      window.Whisper.events,
      newVersion
    );

    // Go back to main process before processing delayed actions
    await window.sqlInitializer.goBackToMainProcess();

    profileKeyResponseQueue.start();
    lightSessionResetQueue.start();
    window.Whisper.deliveryReceiptQueue.start();
    window.Whisper.Notifications.enable();

    await onAppView;

    window.reduxActions.app.initialLoadComplete();

    window.logAppLoadedEvent({
      processedCount: messageReceiver && messageReceiver.getProcessedCount(),
    });
    if (messageReceiver) {
      window.log.info(
        'App loaded - messages:',
        messageReceiver.getProcessedCount()
      );
    }

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
    await window.Signal.Data.saveMessages(messagesToSave);
  }
  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    profileKeyResponseQueue.pause();
    lightSessionResetQueue.pause();
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

    window.Whisper.events.trigger('loadingProgress', initialStartupCount);
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

  function onConfiguration(ev: ConfigurationEvent) {
    ev.confirm();

    const { configuration } = ev;
    const {
      readReceipts,
      typingIndicators,
      unidentifiedDeliveryIndicators,
      linkPreviews,
    } = configuration;

    window.storage.put('read-receipt-setting', Boolean(readReceipts));

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

  function onTyping(ev: TypingEvent) {
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
    if (
      !isDirectConversation(conversation.attributes) &&
      !conversation.hasMember(ourId)
    ) {
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

  async function onStickerPack(ev: StickerPackEvent) {
    ev.confirm();

    const packs = ev.stickerPacks;

    packs.forEach(pack => {
      const { id, key, isInstall, isRemove } = pack || {};

      if (!id || !key || (!isInstall && !isRemove)) {
        window.log.warn(
          'Received malformed sticker pack operation sync message'
        );
        return;
      }

      const status = Stickers.getStickerPackStatus(id);

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
          Stickers.downloadStickerPack(id, key, {
            finalStatus: 'installed',
            fromSync: true,
          });
        }
      }
    });
  }

  async function onContactSyncComplete() {
    window.log.info('onContactSyncComplete');
    await window.storage.put('synced_at', Date.now());
  }

  async function onContactReceived(ev: ContactEvent) {
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
        ourProfileKeyService.set(typedArrayToArrayBuffer(details.profileKey));
      }
    }

    const c = new window.Whisper.Conversation(({
      e164: details.number,
      uuid: details.uuid,
      type: 'private',
    } as Partial<ConversationAttributesType>) as WhatIsThis);
    const validationError = c.validate();
    if (validationError) {
      window.log.error(
        'Invalid contact received:',
        Errors.toLogFormat(validationError)
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

      if (details.profileKey) {
        const profileKey = Bytes.toBase64(details.profileKey);
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
        const verifiedEvent = new VerifiedEvent(
          {
            state: dropNull(verified.state),
            destination: dropNull(verified.destination),
            destinationUuid: dropNull(verified.destinationUuid),
            identityKey: verified.identityKey
              ? typedArrayToArrayBuffer(verified.identityKey)
              : undefined,
            viaContactSync: true,
          },
          noop
        );
        await onVerified(verifiedEvent);
      }

      if (window.Signal.Util.postLinkExperience.isActive()) {
        window.log.info(
          'onContactReceived: Adding the message history disclaimer on link'
        );
        await conversation.addMessageHistoryDisclaimer();
      }
    } catch (error) {
      window.log.error('onContactReceived error:', Errors.toLogFormat(error));
    }
  }

  async function onGroupSyncComplete() {
    window.log.info('onGroupSyncComplete');
    await window.storage.put('synced_at', Date.now());
  }

  // Note: this handler is only for v1 groups received via 'group sync' messages
  async function onGroupReceived(ev: GroupEvent) {
    const details = ev.groupDetails;
    const { id } = details;

    const idBuffer = id;
    const idBytes = idBuffer.byteLength;
    if (idBytes !== 16) {
      window.log.error(
        `onGroupReceived: Id was ${idBytes} bytes, expected 16 bytes. Dropping group.`
      );
      return;
    }

    const conversation = await window.ConversationController.getOrCreateAndWait(
      Bytes.toBinary(id),
      'group'
    );
    if (isGroupV2(conversation.attributes)) {
      window.log.warn(
        'Got group sync for v2 group: ',
        conversation.idForLogging()
      );
      return;
    }

    const memberConversations = details.membersE164.map(e164 =>
      window.ConversationController.getOrCreate(e164, 'private')
    );

    const members = memberConversations.map(c => c.get('id'));

    const updates: Partial<ConversationAttributesType> = {
      name: details.name,
      members,
      type: 'group',
      inbox_position: details.inboxPosition,
    };

    if (details.active) {
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

    if (window.Signal.Util.postLinkExperience.isActive()) {
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
  }: {
    data: MessageEventData;
    confirm: () => void;
    messageDescriptor: MessageDescriptor;
  }) {
    const { profileKey } = data.message;
    strictAssert(
      profileKey !== undefined,
      'handleMessageReceivedProfileUpdate: missing profileKey'
    );
    const sender = window.ConversationController.get(messageDescriptor.id);

    if (sender) {
      // Will do the save for us
      await sender.setProfileKey(profileKey);
    }

    return confirm();
  }

  const respondWithProfileKeyBatcher = createBatcher<ConversationModel>({
    name: 'respondWithProfileKeyBatcher',
    processBatch(batch) {
      const deduped = new Set(batch);
      deduped.forEach(async sender => {
        try {
          if (!(await shouldRespondWithProfileKey(sender))) {
            return;
          }
        } catch (error) {
          window.log.error(
            'respondWithProfileKeyBatcher error',
            error && error.stack
          );
        }

        sender.queueJob('sendProfileKeyUpdate', () =>
          sender.sendProfileKeyUpdate()
        );
      });
    },

    wait: 200,
    maxSize: Infinity,
  });

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  function onMessageReceived(event: MessageEvent) {
    const { data, confirm } = event;

    const messageDescriptor = getMessageDescriptor({
      ...data,
      // 'message' event: for 1:1 converations, the conversation is same as sender
      destination: data.source,
      destinationUuid: data.sourceUuid,
    });

    const { PROFILE_KEY_UPDATE } = Proto.DataMessage.Flags;
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

    if (
      isIncoming(message.attributes) &&
      message.get('unidentifiedDeliveryReceived')
    ) {
      const sender = message.getContact();

      if (!sender) {
        throw new Error('MessageModel has no sender.');
      }

      profileKeyResponseQueue.add(() => {
        respondWithProfileKeyBatcher.add(sender);
      });
    }

    if (data.message.reaction) {
      strictAssert(
        data.message.reaction.targetAuthorUuid,
        'Reaction without targetAuthorUuid'
      );
      const targetAuthorUuid = normalizeUuid(
        data.message.reaction.targetAuthorUuid,
        'DataMessage.Reaction.targetAuthorUuid'
      );

      const { reaction } = data.message;

      if (!isValidReactionEmoji(reaction.emoji)) {
        window.log.warn('Received an invalid reaction emoji. Dropping it');
        confirm();
        return Promise.resolve();
      }

      window.log.info(
        'Queuing incoming reaction for',
        reaction.targetTimestamp
      );
      const reactionModel = Reactions.getSingleton().add({
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp: Date.now(),
        fromId: window.ConversationController.ensureContactIds({
          e164: data.source,
          uuid: data.sourceUuid,
        }),
      });
      // Note: We do not wait for completion here
      Reactions.getSingleton().onReaction(reactionModel);
      confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      window.log.info('Queuing incoming DOE for', del.targetSentTimestamp);
      const deleteModel = Deletes.getSingleton().add({
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: window.ConversationController.ensureContactIds({
          e164: data.source,
          uuid: data.sourceUuid,
        }),
      });
      // Note: We do not wait for completion here
      Deletes.getSingleton().onDelete(deleteModel);
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

  async function onProfileKeyUpdate({ data, confirm }: ProfileKeyUpdateEvent) {
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
  }: {
    data: SentEventData;
    confirm: () => void;
    messageDescriptor: MessageDescriptor;
  }) {
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
    const { profileKey } = data.message;
    strictAssert(
      profileKey !== undefined,
      'handleMessageSentProfileUpdate: missing profileKey'
    );

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);

    return confirm();
  }

  function createSentMessage(
    data: SentEventData,
    descriptor: MessageDescriptor
  ) {
    const now = Date.now();
    const timestamp = data.timestamp || now;

    const ourId = window.ConversationController.getOurConversationIdOrThrow();

    const { unidentifiedStatus = [] } = data;

    const sendStateByConversationId: SendStateByConversationId = unidentifiedStatus.reduce(
      (result: SendStateByConversationId, { destinationUuid, destination }) => {
        const conversationId = window.ConversationController.ensureContactIds({
          uuid: destinationUuid,
          e164: destination,
          highTrust: true,
        });
        if (!conversationId || conversationId === ourId) {
          return result;
        }

        return {
          ...result,
          [conversationId]: {
            status: SendStatus.Pending,
            updatedAt: timestamp,
          },
        };
      },
      {
        [ourId]: {
          status: SendStatus.Sent,
          updatedAt: timestamp,
        },
      }
    );

    let unidentifiedDeliveries: Array<string> = [];
    if (unidentifiedStatus.length) {
      const unidentified = window._.filter(data.unidentifiedStatus, item =>
        Boolean(item.unidentified)
      );
      unidentifiedDeliveries = unidentified
        .map(item => item.destinationUuid || item.destination)
        .filter(isNotNil);
    }

    return new window.Whisper.Message(({
      source: window.textsecure.storage.user.getNumber(),
      sourceUuid: window.textsecure.storage.user.getUuid(),
      sourceDevice: data.device,
      sent_at: timestamp,
      serverTimestamp: data.serverTimestamp,
      received_at: data.receivedAtCounter,
      received_at_ms: data.receivedAtDate,
      conversationId: descriptor.id,
      timestamp,
      type: 'outgoing',
      sendStateByConversationId,
      unidentifiedDeliveries,
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || timestamp,
        now
      ),
    } as Partial<MessageAttributesType>) as WhatIsThis);
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
    message: ProcessedDataMessage;
    source?: string;
    sourceUuid?: string;
    destination?: string;
    destinationUuid?: string;
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
  function onSentMessage(event: SentEvent) {
    const { data, confirm } = event;

    const source = window.textsecure.storage.user.getNumber();
    const sourceUuid = window.textsecure.storage.user.getUuid();
    strictAssert(source && sourceUuid, 'Missing user number and uuid');

    const messageDescriptor = getMessageDescriptor({
      ...data,

      // 'sent' event: the sender is always us!
      source,
      sourceUuid,
    });

    const { PROFILE_KEY_UPDATE } = Proto.DataMessage.Flags;
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
      strictAssert(
        data.message.reaction.targetAuthorUuid,
        'Reaction without targetAuthorUuid'
      );
      const targetAuthorUuid = normalizeUuid(
        data.message.reaction.targetAuthorUuid,
        'DataMessage.Reaction.targetAuthorUuid'
      );

      const { reaction } = data.message;

      if (!isValidReactionEmoji(reaction.emoji)) {
        window.log.warn('Received an invalid reaction emoji. Dropping it');
        event.confirm();
        return Promise.resolve();
      }

      window.log.info('Queuing sent reaction for', reaction.targetTimestamp);
      const reactionModel = Reactions.getSingleton().add({
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp: Date.now(),
        fromId: window.ConversationController.getOurConversationId(),
        fromSync: true,
      });
      // Note: We do not wait for completion here
      Reactions.getSingleton().onReaction(reactionModel);

      event.confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      window.log.info('Queuing sent DOE for', del.targetSentTimestamp);
      const deleteModel = Deletes.getSingleton().add({
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: window.ConversationController.getOurConversationId(),
      });
      // Note: We do not wait for completion here
      Deletes.getSingleton().onDelete(deleteModel);
      confirm();
      return Promise.resolve();
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      event.confirm();
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
    data: MessageEventData,
    descriptor: MessageDescriptor
  ) {
    assert(
      Boolean(data.receivedAtCounter),
      `Did not receive receivedAtCounter for message: ${data.timestamp}`
    );
    return new window.Whisper.Message(({
      source: data.source,
      sourceUuid: data.sourceUuid,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      serverGuid: data.serverGuid,
      serverTimestamp: data.serverTimestamp,
      received_at: data.receivedAtCounter,
      received_at_ms: data.receivedAtDate,
      conversationId: descriptor.id,
      unidentifiedDeliveryReceived: data.unidentifiedDeliveryReceived,
      type: 'incoming',
      unread: true,
      timestamp: data.timestamp,
    } as Partial<MessageAttributesType>) as WhatIsThis);
  }

  // Returns `false` if this message isn't a group call message.
  function handleGroupCallUpdateMessage(
    message: ProcessedDataMessage,
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
    }

    if (messageReceiver) {
      messageReceiver.unregisterBatchers();
      messageReceiver = undefined;
    }

    onEmpty();

    window.log.warn(
      'Client is no longer authorized; deleting local configuration'
    );
    window.Signal.Util.Registration.remove();

    const NUMBER_ID_KEY = 'number_id';
    const UUID_ID_KEY = 'uuid_id';
    const VERSION_KEY = 'version';
    const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
    const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

    const previousNumberId = window.textsecure.storage.get(NUMBER_ID_KEY);
    const previousUuidId = window.textsecure.storage.get(UUID_ID_KEY);
    const lastProcessedIndex = window.textsecure.storage.get(
      LAST_PROCESSED_INDEX_KEY
    );
    const isMigrationComplete = window.textsecure.storage.get(
      IS_MIGRATION_COMPLETE_KEY
    );

    try {
      await window.textsecure.storage.protocol.removeAllConfiguration();

      // This was already done in the database with removeAllConfiguration; this does it
      //   for all the conversation models in memory.
      window.getConversations().forEach(conversation => {
        // eslint-disable-next-line no-param-reassign
        delete conversation.attributes.senderKeyInfo;
      });

      // These two bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
      window.Signal.Util.Registration.markEverDone();
      if (previousNumberId !== undefined) {
        await window.textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);
      }
      if (previousUuidId !== undefined) {
        await window.textsecure.storage.put(UUID_ID_KEY, previousUuidId);
      }

      // These two are important to ensure we don't rip through every message
      //   in the database attempting to upgrade it after starting up again.
      await window.textsecure.storage.put(
        IS_MIGRATION_COMPLETE_KEY,
        isMigrationComplete || false
      );
      if (lastProcessedIndex !== undefined) {
        await window.textsecure.storage.put(
          LAST_PROCESSED_INDEX_KEY,
          lastProcessedIndex
        );
      } else {
        await window.textsecure.storage.remove(LAST_PROCESSED_INDEX_KEY);
      }
      await window.textsecure.storage.put(VERSION_KEY, window.getVersion());

      window.log.info('Successfully cleared local configuration');
    } catch (eraseError) {
      window.log.error(
        'Something went wrong clearing local configuration',
        eraseError && eraseError.stack ? eraseError.stack : eraseError
      );
    }
  }

  function onError(ev: ErrorEvent) {
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
        const timeout = reconnectBackOff.getAndIncrement();

        window.log.info(`retrying in ${timeout}ms`);
        reconnectTimer = setTimeout(connect, timeout);

        window.Whisper.events.trigger('reconnectTimer');

        // If we couldn't connect during startup - we should still switch SQL to
        // the main process to avoid stalling UI.
        window.sqlInitializer.goBackToMainProcess();
      }
      return;
    }

    window.log.warn('background onError: Doing nothing with incoming error');
  }

  async function onViewSync(ev: ViewSyncEvent) {
    ev.confirm();

    const { source, sourceUuid, timestamp } = ev;
    window.log.info(`view sync ${source} ${timestamp}`);

    const sync = ViewSyncs.getSingleton().add({
      source,
      sourceUuid,
      timestamp,
    });

    ViewSyncs.getSingleton().onSync(sync);
  }

  async function onFetchLatestSync(ev: FetchLatestEvent) {
    ev.confirm();

    const { eventType } = ev;

    const FETCH_LATEST_ENUM = Proto.SyncMessage.FetchLatest.Type;

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

  async function onKeysSync(ev: KeysEvent) {
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

  async function onMessageRequestResponse(ev: MessageRequestResponseEvent) {
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

    const sync = MessageRequests.getSingleton().add({
      threadE164,
      threadUuid,
      groupId,
      groupV2Id,
      type: messageRequestResponseType,
    });

    MessageRequests.getSingleton().onResponse(sync);
  }

  function onReadReceipt(ev: ReadEvent) {
    const {
      envelopeTimestamp,
      timestamp,
      source,
      sourceUuid,
      sourceDevice,
    } = ev.read;
    const sourceConversationId = window.ConversationController.ensureContactIds(
      {
        e164: source,
        uuid: sourceUuid,
        highTrust: true,
      }
    );
    window.log.info(
      'read receipt',
      source,
      sourceUuid,
      sourceDevice,
      envelopeTimestamp,
      sourceConversationId,
      'for sent message',
      timestamp
    );

    ev.confirm();

    if (!window.storage.get('read-receipt-setting') || !sourceConversationId) {
      return;
    }

    const receipt = MessageReceipts.getSingleton().add({
      messageSentAt: timestamp,
      receiptTimestamp: envelopeTimestamp,
      sourceConversationId,
      sourceDevice,
      type: MessageReceiptType.Read,
    });

    // Note: We do not wait for completion here
    MessageReceipts.getSingleton().onReceipt(receipt);
  }

  function onReadSync(ev: ReadSyncEvent) {
    const { envelopeTimestamp, sender, senderUuid, timestamp } = ev.read;
    const readAt = envelopeTimestamp;
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

    const receipt = ReadSyncs.getSingleton().add({
      senderId,
      sender,
      senderUuid,
      timestamp,
      readAt,
    });

    receipt.on('remove', ev.confirm);

    // Note: Here we wait, because we want read states to be in the database
    //   before we move on.
    return ReadSyncs.getSingleton().onReceipt(receipt);
  }

  async function onVerified(ev: VerifiedEvent) {
    const e164 = ev.verified.destination;
    const uuid = ev.verified.destinationUuid;
    const key = ev.verified.identityKey;
    let state;

    if (ev.confirm) {
      ev.confirm();
    }

    const c = new window.Whisper.Conversation(({
      e164,
      uuid,
      type: 'private',
    } as Partial<ConversationAttributesType>) as WhatIsThis);
    const error = c.validate();
    if (error) {
      window.log.error(
        'Invalid verified sync received:',
        e164,
        uuid,
        Errors.toLogFormat(error)
      );
      return;
    }

    switch (ev.verified.state) {
      case Proto.Verified.State.DEFAULT:
        state = 'DEFAULT';
        break;
      case Proto.Verified.State.VERIFIED:
        state = 'VERIFIED';
        break;
      case Proto.Verified.State.UNVERIFIED:
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
      ev.verified.viaContactSync ? 'via contact sync' : ''
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
      viaContactSync: ev.verified.viaContactSync,
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

  function onDeliveryReceipt(ev: DeliveryEvent) {
    const { deliveryReceipt } = ev;
    const {
      envelopeTimestamp,
      sourceUuid,
      source,
      sourceDevice,
      timestamp,
    } = deliveryReceipt;

    ev.confirm();

    const sourceConversationId = window.ConversationController.ensureContactIds(
      {
        e164: source,
        uuid: sourceUuid,
        highTrust: true,
      }
    );

    window.log.info(
      'delivery receipt from',
      source,
      sourceUuid,
      sourceDevice,
      sourceConversationId,
      envelopeTimestamp,
      'for sent message',
      timestamp
    );

    if (!sourceConversationId) {
      window.log.info('no conversation for', source, sourceUuid);
      return;
    }

    const receipt = MessageReceipts.getSingleton().add({
      messageSentAt: timestamp,
      receiptTimestamp: envelopeTimestamp,
      sourceConversationId,
      sourceDevice,
      type: MessageReceiptType.Delivery,
    });

    // Note: We don't wait for completion here
    MessageReceipts.getSingleton().onReceipt(receipt);
  }
}

window.startApp = startApp;
