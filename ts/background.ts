// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { webFrame } from 'electron';
import { isNumber } from 'lodash';
import { bindActionCreators } from 'redux';
import { render } from 'react-dom';
import { batch as batchDispatch } from 'react-redux';

import MessageReceiver from './textsecure/MessageReceiver';
import type {
  SessionResetsType,
  ProcessedDataMessage,
} from './textsecure/Types.d';
import { HTTPError } from './textsecure/Errors';
import createTaskWithTimeout, {
  suspendTasksWithTimeout,
  resumeTasksWithTimeout,
} from './textsecure/TaskWithTimeout';
import type {
  MessageAttributesType,
  ConversationAttributesType,
  ReactionAttributesType,
  ValidateConversationType,
} from './model-types.d';
import * as Bytes from './Bytes';
import * as Timers from './Timers';
import * as indexedDb from './indexeddb';
import type { MenuOptionsType } from './types/menu';
import type { Receipt } from './types/Receipt';
import { SocketStatus } from './types/SocketStatus';
import { DEFAULT_CONVERSATION_COLOR } from './types/Colors';
import { ThemeType } from './types/Util';
import { ChallengeHandler } from './challenge';
import * as durations from './util/durations';
import { explodePromise } from './util/explodePromise';
import { isWindowDragElement } from './util/isWindowDragElement';
import { assert, strictAssert } from './util/assert';
import { normalizeUuid } from './util/normalizeUuid';
import { filter } from './util/iterables';
import { isNotNil } from './util/isNotNil';
import { setAppLoadingScreenMessage } from './setAppLoadingScreenMessage';
import { IdleDetector } from './IdleDetector';
import { expiringMessagesDeletionService } from './services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from './services/tapToViewMessagesDeletionService';
import { getStoriesForRedux, loadStories } from './services/storyLoader';
import {
  getDistributionListsForRedux,
  loadDistributionLists,
} from './services/distributionListLoader';
import { senderCertificateService } from './services/senderCertificate';
import { GROUP_CREDENTIALS_KEY } from './services/groupCredentialFetcher';
import * as KeyboardLayout from './services/keyboardLayout';
import { RoutineProfileRefresher } from './routineProfileRefresh';
import { isMoreRecentThan, isOlderThan, toDayMillis } from './util/timestamp';
import { isValidReactionEmoji } from './reactions/isValidReactionEmoji';
import type { ConversationModel } from './models/conversations';
import { getContact } from './messages/helpers';
import { migrateMessageData } from './messages/migrateMessageData';
import { createBatcher } from './util/batcher';
import { updateConversationsWithUuidLookup } from './updateConversationsWithUuidLookup';
import { initializeAllJobQueues } from './jobs/initializeAllJobQueues';
import { removeStorageKeyJobQueue } from './jobs/removeStorageKeyJobQueue';
import { ourProfileKeyService } from './services/ourProfileKey';
import { notificationService } from './services/notifications';
import { areWeASubscriberService } from './services/areWeASubscriber';
import { startTimeTravelDetector } from './util/startTimeTravelDetector';
import { shouldRespondWithProfileKey } from './util/shouldRespondWithProfileKey';
import { LatestQueue } from './util/LatestQueue';
import { parseIntOrThrow } from './util/parseIntOrThrow';
import { getProfile } from './util/getProfile';
import type {
  ConfigurationEvent,
  ContactEvent,
  DecryptionErrorEvent,
  DeliveryEvent,
  EnvelopeEvent,
  ErrorEvent,
  FetchLatestEvent,
  GroupEvent,
  KeysEvent,
  MessageEvent,
  MessageEventData,
  MessageRequestResponseEvent,
  ProfileKeyUpdateEvent,
  ReadEvent,
  ReadSyncEvent,
  RetryRequestEvent,
  SentEvent,
  SentEventData,
  StickerPackEvent,
  TypingEvent,
  ViewEvent,
  ViewOnceOpenSyncEvent,
  ViewSyncEvent,
} from './textsecure/messageReceiverEvents';
import type { WebAPIType } from './textsecure/WebAPI';
import * as KeyChangeListener from './textsecure/KeyChangeListener';
import { RotateSignedPreKeyListener } from './textsecure/RotateSignedPreKeyListener';
import { isDirectConversation, isGroupV2 } from './util/whatTypeOfConversation';
import { BackOff, FIBONACCI_TIMEOUTS } from './util/BackOff';
import { AppViewType } from './state/ducks/app';
import type { BadgesStateType } from './state/ducks/badges';
import { badgeImageFileDownloader } from './badges/badgeImageFileDownloader';
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
import { ViewOnceOpenSyncs } from './messageModifiers/ViewOnceOpenSyncs';
import type { DeleteAttributesType } from './messageModifiers/Deletes';
import type { MessageReceiptAttributesType } from './messageModifiers/MessageReceipts';
import type { MessageRequestAttributesType } from './messageModifiers/MessageRequests';
import type { ReadSyncAttributesType } from './messageModifiers/ReadSyncs';
import type { ViewSyncAttributesType } from './messageModifiers/ViewSyncs';
import type { ViewOnceOpenSyncAttributesType } from './messageModifiers/ViewOnceOpenSyncs';
import { ReadStatus } from './messages/MessageReadStatus';
import type { SendStateByConversationId } from './messages/MessageSendState';
import { SendStatus } from './messages/MessageSendState';
import * as AttachmentDownloads from './messageModifiers/AttachmentDownloads';
import * as Conversation from './types/Conversation';
import * as Stickers from './types/Stickers';
import * as Errors from './types/errors';
import { SignalService as Proto } from './protobuf';
import { onRetryRequest, onDecryptionError } from './util/handleRetry';
import { themeChanged } from './shims/themeChanged';
import { createIPCEvents } from './util/createIPCEvents';
import { RemoveAllConfiguration } from './types/RemoveAllConfiguration';
import { isValidUuid, UUIDKind, UUID } from './types/UUID';
import * as log from './logging/log';
import { loadRecentEmojis } from './util/loadRecentEmojis';
import { deleteAllLogs } from './util/deleteAllLogs';
import { ReactWrapperView } from './views/ReactWrapperView';
import { ToastCaptchaFailed } from './components/ToastCaptchaFailed';
import { ToastCaptchaSolved } from './components/ToastCaptchaSolved';
import { ToastConversationArchived } from './components/ToastConversationArchived';
import { ToastConversationUnarchived } from './components/ToastConversationUnarchived';
import { showToast } from './util/showToast';
import { startInteractionMode } from './windows/startInteractionMode';
import type { MainWindowStatsType } from './windows/context';
import { deliveryReceiptsJobQueue } from './jobs/deliveryReceiptsJobQueue';
import { updateOurUsernameAndPni } from './util/updateOurUsernameAndPni';
import { ReactionSource } from './reactions/ReactionSource';
import { singleProtoJobQueue } from './jobs/singleProtoJobQueue';
import { getInitialState } from './state/getInitialState';
import { conversationJobQueue } from './jobs/conversationJobQueue';
import { SeenStatus } from './MessageSeenStatus';
import MessageSender from './textsecure/SendMessage';
import type AccountManager from './textsecure/AccountManager';
import { onStoryRecipientUpdate } from './util/onStoryRecipientUpdate';
import { validateConversation } from './util/validateConversation';

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
  window.textsecure.storage.protocol = new window.SignalProtocolStore();

  if (window.initialTheme === ThemeType.light) {
    document.body.classList.add('light-theme');
  }
  if (window.initialTheme === ThemeType.dark) {
    document.body.classList.add('dark-theme');
  }

  const idleDetector = new IdleDetector();

  await KeyboardLayout.initialize();

  window.Whisper.events = window._.clone(window.Backbone.Events);
  window.Signal.Util.MessageController.install();
  window.Signal.conversationControllerStart();
  window.startupProcessingQueue = new window.Signal.Util.StartupQueue();
  notificationService.initialize({
    i18n: window.i18n,
    storage: window.storage,
  });
  window.attachmentDownloadQueue = [];

  await window.Signal.Util.initializeMessageCounter();

  let initialBadgesState: BadgesStateType = { byId: {} };
  async function loadInitialBadgesState(): Promise<void> {
    initialBadgesState = {
      byId: window.Signal.Util.makeLookup(
        await window.Signal.Data.getAllBadges(),
        'id'
      ),
    };
  }

  // Initialize WebAPI as early as possible
  let server: WebAPIType | undefined;
  let messageReceiver: MessageReceiver | undefined;
  let challengeHandler: ChallengeHandler | undefined;
  let routineProfileRefresher: RoutineProfileRefresher | undefined;

  window.storage.onready(() => {
    server = window.WebAPI.connect(
      window.textsecure.storage.user.getWebAPICredentials()
    );
    window.textsecure.server = server;

    initializeAllJobQueues({
      server,
    });

    challengeHandler = new ChallengeHandler({
      storage: window.storage,

      startQueue(conversationId: string) {
        conversationJobQueue.resolveVerificationWaiter(conversationId);
      },

      requestChallenge(request) {
        window.sendChallengeRequest(request);
      },

      async sendChallengeResponse(data) {
        const { messaging } = window.textsecure;
        if (!messaging) {
          throw new Error('sendChallengeResponse: messaging is not available!');
        }
        await messaging.sendChallengeResponse(data);
      },

      onChallengeFailed() {
        // TODO: DESKTOP-1530
        // Display humanized `retryAfter`
        showToast(ToastCaptchaFailed);
      },

      onChallengeSolved() {
        showToast(ToastCaptchaSolved);
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

    window.Signal.challengeHandler = challengeHandler;

    log.info('Initializing MessageReceiver');
    messageReceiver = new MessageReceiver({
      server,
      storage: window.storage,
      serverTrustRoot: window.getServerTrustRoot(),
    });

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
      'envelope',
      queuedEventListener(onEnvelopeReceived, false)
    );
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
      queuedEventListener(onContactReceived, false)
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
      'viewSync',
      queuedEventListener(onViewSync)
    );
    messageReceiver.addEventListener(
      'read',
      queuedEventListener(onReadReceipt)
    );
    messageReceiver.addEventListener(
      'view',
      queuedEventListener(onViewReceipt)
    );
    messageReceiver.addEventListener(
      'error',
      queuedEventListener(onError, false)
    );
    messageReceiver.addEventListener(
      'decryption-error',
      queuedEventListener((event: DecryptionErrorEvent) => {
        onDecryptionErrorQueue.add(() => onDecryptionError(event));
      })
    );
    messageReceiver.addEventListener(
      'retry-request',
      queuedEventListener((event: RetryRequestEvent) => {
        onRetryRequestQueue.add(() => onRetryRequest(event));
      })
    );
    messageReceiver.addEventListener('empty', queuedEventListener(onEmpty));
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
      'viewOnceOpenSync',
      queuedEventListener(onViewOnceOpenSync)
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
    messageReceiver.addEventListener(
      'storyRecipientUpdate',
      queuedEventListener(onStoryRecipientUpdate, false)
    );
  });

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
    strictAssert(server, 'WebAPI not ready');

    senderCertificateService.initialize({
      server,
      navigator,
      onlineEventTarget: window,
      storage: window.storage,
    });

    areWeASubscriberService.update(window.storage, server);
  });

  const eventHandlerQueue = new window.PQueue({
    concurrency: 1,
    timeout: durations.MINUTE * 30,
  });

  // Note: this queue is meant to allow for stop/start of tasks, not limit parallelism.
  const profileKeyResponseQueue = new window.PQueue();
  profileKeyResponseQueue.pause();

  const lightSessionResetQueue = new window.PQueue({ concurrency: 1 });
  window.Signal.Services.lightSessionResetQueue = lightSessionResetQueue;
  lightSessionResetQueue.pause();

  const onDecryptionErrorQueue = new window.PQueue({ concurrency: 1 });
  onDecryptionErrorQueue.pause();

  const onRetryRequestQueue = new window.PQueue({ concurrency: 1 });
  onRetryRequestQueue.pause();

  window.Whisper.deliveryReceiptQueue = new window.PQueue({
    concurrency: 1,
    timeout: durations.MINUTE * 30,
  });
  window.Whisper.deliveryReceiptQueue.pause();
  window.Whisper.deliveryReceiptBatcher =
    window.Signal.Util.createBatcher<Receipt>({
      name: 'Whisper.deliveryReceiptBatcher',
      wait: 500,
      maxSize: 100,
      processBatch: async deliveryReceipts => {
        await deliveryReceiptsJobQueue.add({ deliveryReceipts });
      },
    });

  if (window.platform === 'darwin') {
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

  startInteractionMode();

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

  const { Message } = window.Signal.Types;
  const {
    upgradeMessageSchema,
    writeNewAttachmentData,
    deleteAttachmentData,
    doesAttachmentExist,
  } = window.Signal.Migrations;

  log.info('background page reloaded');
  log.info('environment:', window.getEnvironment());

  let newVersion = false;
  let lastVersion: string | undefined;

  window.document.title = window.getTitle();

  document.documentElement.setAttribute(
    'lang',
    window.getLocale().substring(0, 2)
  );

  KeyChangeListener.init(window.textsecure.storage.protocol);
  window.textsecure.storage.protocol.on('removePreKey', (ourUuid: UUID) => {
    const uuidKind = window.textsecure.storage.user.getOurUuidKind(ourUuid);
    window.getAccountManager().refreshPreKeys(uuidKind);
  });

  window.getSocketStatus = () => {
    if (server === undefined) {
      return SocketStatus.CLOSED;
    }
    return server.getSocketStatus();
  };
  let accountManager: AccountManager;
  window.getAccountManager = () => {
    if (accountManager) {
      return accountManager;
    }
    if (!server) {
      throw new Error('getAccountManager: server is not available!');
    }

    accountManager = new window.textsecure.AccountManager(server);
    accountManager.addEventListener('registration', () => {
      window.Whisper.events.trigger('userChanged', false);

      window.Signal.Util.Registration.markDone();
      log.info('dispatching registration event');
      window.Whisper.events.trigger('registration_done');
    });
    return accountManager;
  };

  const cancelInitializationMessage = setAppLoadingScreenMessage(
    undefined,
    window.i18n
  );

  const version = await window.Signal.Data.getItemById('version');
  if (!version) {
    const isIndexedDBPresent = await indexedDb.doesDatabaseExist();
    if (isIndexedDBPresent) {
      log.info('Found IndexedDB database.');
      try {
        log.info('Confirming deletion of old data with user...');

        try {
          await new Promise<void>((resolve, reject) => {
            window.showConfirmationDialog({
              onTopOfEverything: true,
              cancelText: window.i18n('quit'),
              confirmStyle: 'negative',
              message: window.i18n('deleteOldIndexedDBData'),
              okText: window.i18n('deleteOldData'),
              reject: () => reject(),
              resolve: () => resolve(),
            });
          });
        } catch (error) {
          log.info(
            'User chose not to delete old data. Shutting down.',
            error && error.stack ? error.stack : error
          );
          window.shutdown();
          return;
        }

        log.info('Deleting all previously-migrated data in SQL...');
        log.info('Deleting IndexedDB file...');

        await Promise.all([
          indexedDb.removeDatabase(),
          window.Signal.Data.removeAll(),
          window.Signal.Data.removeIndexedDBFiles(),
        ]);
        log.info('Done with SQL deletion and IndexedDB file deletion.');
      } catch (error) {
        log.error(
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

  log.info('Storage fetch');
  window.storage.fetch();

  function mapOldThemeToNew(
    theme: Readonly<
      'system' | 'light' | 'dark' | 'android' | 'ios' | 'android-dark'
    >
  ): 'system' | 'light' | 'dark' {
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

    strictAssert(server !== undefined, 'WebAPI not ready');

    cleanupSessionResets();

    // These make key operations available to IPC handlers created in preload.js
    window.Events = createIPCEvents({
      shutdown: async () => {
        log.info('background/shutdown');

        window.Signal.Util.flushMessageCounter();

        // Stop background processing
        AttachmentDownloads.stop();
        idleDetector.stop();

        // Stop processing incoming messages
        if (messageReceiver) {
          strictAssert(
            server !== undefined,
            'WebAPI should be initialized together with MessageReceiver'
          );
          log.info('background/shutdown: shutting down messageReceiver');
          server.unregisterRequestHandler(messageReceiver);
          messageReceiver.stopProcessing();
          await window.waitForAllBatchers();
        }

        log.info('background/shutdown: flushing conversations');

        // Flush debounced updates for conversations
        await Promise.all(
          window.ConversationController.getAll().map(convo =>
            convo.flushDebouncedUpdates()
          )
        );

        log.info('background/shutdown: waiting for all batchers');

        // A number of still-to-queue database queries might be waiting inside batchers.
        //   We wait for these to empty first, and then shut down the data interface.
        await Promise.all([
          window.waitForAllBatchers(),
          window.waitForAllWaitBatchers(),
        ]);

        log.info('background/shutdown: closing the database');

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },
    });

    const zoomFactor = window.Events.getZoomFactor();
    webFrame.setZoomFactor(zoomFactor);
    document.body.style.setProperty('--zoom-factor', zoomFactor.toString());

    window.addEventListener('resize', () => {
      document.body.style.setProperty(
        '--zoom-factor',
        webFrame.getZoomFactor().toString()
      );
    });

    // How long since we were last running?
    const lastHeartbeat = toDayMillis(window.storage.get('lastHeartbeat', 0));
    const previousLastStartup = window.storage.get('lastStartup');
    await window.storage.put('lastStartup', Date.now());

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (lastHeartbeat > 0 && isOlderThan(lastHeartbeat, THIRTY_DAYS)) {
      log.warn(
        `This instance has not been used for 30 days. Last heartbeat: ${lastHeartbeat}. Last startup: ${previousLastStartup}.`
      );
      await unlinkAndDisconnect(RemoveAllConfiguration.Soft);
    }

    // Start heartbeat timer
    window.storage.put('lastHeartbeat', toDayMillis(Date.now()));
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(
      () => window.storage.put('lastHeartbeat', toDayMillis(Date.now())),
      TWELVE_HOURS
    );

    const currentVersion = window.getVersion();
    lastVersion = window.storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await window.storage.put('version', currentVersion);

    if (newVersion && lastVersion) {
      log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      const remoteBuildExpiration = window.storage.get('remoteBuildExpiration');
      if (remoteBuildExpiration) {
        log.info(
          `Clearing remoteBuildExpiration. Previous value was ${remoteBuildExpiration}`
        );
        window.storage.remove('remoteBuildExpiration');
      }

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

      const themeSetting = window.Events.getThemeSetting();
      const newThemeSetting = mapOldThemeToNew(themeSetting);
      if (window.isBeforeVersion(lastVersion, 'v1.25.0')) {
        if (newThemeSetting === window.systemTheme) {
          window.Events.setThemeSetting('system');
        } else {
          window.Events.setThemeSetting(newThemeSetting);
        }
      }

      if (
        window.isBeforeVersion(lastVersion, 'v1.36.0-beta.1') &&
        window.isAfterVersion(lastVersion, 'v1.35.0-beta.1')
      ) {
        await window.Signal.Services.eraseAllStorageServiceState();
      }

      if (window.isBeforeVersion(lastVersion, 'v5.2.0')) {
        const legacySenderCertificateStorageKey = 'senderCertificateWithUuid';
        await removeStorageKeyJobQueue.add({
          key: legacySenderCertificateStorageKey,
        });
      }

      if (window.isBeforeVersion(lastVersion, 'v5.18.0')) {
        await window.storage.remove('senderCertificate');
        await window.storage.remove('senderCertificateNoE164');
      }

      if (window.isBeforeVersion(lastVersion, 'v5.19.0')) {
        await window.storage.remove(GROUP_CREDENTIALS_KEY);
      }

      if (window.isBeforeVersion(lastVersion, 'v5.37.0-alpha')) {
        const legacyChallengeKey = 'challenge:retry-message-ids';
        await removeStorageKeyJobQueue.add({
          key: legacyChallengeKey,
        });

        await window.Signal.Data.clearAllErrorStickerPackAttempts();
      }

      if (window.isBeforeVersion(lastVersion, 'v5.51.0-beta.2')) {
        await window.storage.put('groupCredentials', []);
        await window.Signal.Data.removeAllProfileKeyCredentials();
      }

      // This one should always be last - it could restart the app
      if (window.isBeforeVersion(lastVersion, 'v5.30.0-alpha')) {
        await deleteAllLogs();
        window.restart();
        return;
      }
    }

    setAppLoadingScreenMessage(
      window.i18n('optimizingApplication'),
      window.i18n
    );

    if (newVersion) {
      // We've received reports that this update can take longer than two minutes, so we
      //   allow it to continue and just move on in that timeout case.
      try {
        await window.Signal.Data.cleanupOrphanedAttachments();
      } catch (error) {
        log.error(
          'background: Failed to cleanup orphaned attachments:',
          error && error.stack ? error.stack : error
        );
      }

      // Don't block on the following operation
      window.Signal.Data.ensureFilePermissions();
    }

    try {
      await window.Signal.Data.startInRendererProcess();
    } catch (err) {
      log.error('SQL failed to initialize', err && err.stack ? err.stack : err);
    }

    setAppLoadingScreenMessage(window.i18n('loading'), window.i18n);

    let isMigrationWithIndexComplete = false;
    let isIdleTaskProcessing = false;
    log.info(
      `Starting background data migration. Target version: ${Message.CURRENT_SCHEMA_VERSION}`
    );
    idleDetector.on('idle', async () => {
      const NUM_MESSAGES_PER_BATCH = 25;
      const BATCH_DELAY = 10 * durations.SECOND;

      if (isIdleTaskProcessing) {
        log.warn(
          'idleDetector/idle: previous batch incomplete, not starting another'
        );
        return;
      }
      try {
        isIdleTaskProcessing = true;

        if (!isMigrationWithIndexComplete) {
          log.warn(
            `idleDetector/idle: fetching at most ${NUM_MESSAGES_PER_BATCH} for migration`
          );
          const batchWithIndex = await migrateMessageData({
            numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
            upgradeMessageSchema,
            getMessagesNeedingUpgrade:
              window.Signal.Data.getMessagesNeedingUpgrade,
            saveMessages: window.Signal.Data.saveMessages,
          });
          log.info('idleDetector/idle: Upgraded messages:', batchWithIndex);
          isMigrationWithIndexComplete = batchWithIndex.done;
        }
      } finally {
        idleDetector.stop();

        if (isMigrationWithIndexComplete) {
          log.info(
            'idleDetector/idle: Background migration complete. Stopping.'
          );
        } else {
          log.info(
            `idleDetector/idle: Background migration not complete. Pausing for ${BATCH_DELAY}ms.`
          );

          setTimeout(() => {
            idleDetector.start();
          }, BATCH_DELAY);
        }

        isIdleTaskProcessing = false;
      }
    });

    window.Signal.RemoteConfig.initRemoteConfig(server);

    let retryReceiptLifespan: number | undefined;
    try {
      retryReceiptLifespan = parseIntOrThrow(
        window.Signal.RemoteConfig.getValue('desktop.retryReceiptLifespan'),
        'retryReceiptLifeSpan'
      );
    } catch (error) {
      log.warn(
        'Failed to parse integer out of desktop.retryReceiptLifespan feature flag'
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
      let sentProtoMaxAge = 14 * DAY;

      try {
        sentProtoMaxAge = parseIntOrThrow(
          window.Signal.RemoteConfig.getValue('desktop.retryRespondMaxAge'),
          'retryRespondMaxAge'
        );
      } catch (error) {
        log.warn(
          'background/setInterval: Failed to parse integer from desktop.retryRespondMaxAge feature flag',
          error && error.stack ? error.stack : error
        );
      }

      try {
        await window.Signal.Data.deleteSentProtosOlderThan(
          now - sentProtoMaxAge
        );
      } catch (error) {
        log.error(
          'background/onready/setInterval: Error deleting sent protos: ',
          error && error.stack ? error.stack : error
        );
      }

      try {
        const expired = await retryPlaceholders.getExpiredAndRemove();
        log.info(
          `retryPlaceholders/interval: Found ${expired.length} expired items`
        );
        expired.forEach(item => {
          const { conversationId, senderUuid, sentAt } = item;
          const conversation =
            window.ConversationController.get(conversationId);
          if (conversation) {
            const receivedAt = Date.now();
            const receivedAtCounter =
              window.Signal.Util.incrementMessageCounter();
            conversation.queueJob('addDeliveryIssue', () =>
              conversation.addDeliveryIssue({
                receivedAt,
                receivedAtCounter,
                senderUuid,
                sentAt,
              })
            );
          }
        });
      } catch (error) {
        log.error(
          'background/onready/setInterval: Error getting expired retry placeholders: ',
          error && error.stack ? error.stack : error
        );
      }
    }, FIVE_MINUTES);

    let mainWindowStats = {
      isMaximized: false,
      isFullScreen: false,
    };

    let menuOptions = {
      development: false,
      devTools: false,
      includeSetup: false,
      isProduction: true,
      platform: 'unknown',
    };

    try {
      await Promise.all([
        window.ConversationController.load(),
        Stickers.load(),
        loadRecentEmojis(),
        loadInitialBadgesState(),
        loadStories(),
        loadDistributionLists(),
        window.textsecure.storage.protocol.hydrateCaches(),
        (async () => {
          mainWindowStats = await window.SignalContext.getMainWindowStats();
        })(),
        (async () => {
          menuOptions = await window.SignalContext.getMenuOptions();
        })(),
      ]);
      await window.ConversationController.checkForConflicts();
    } catch (error) {
      log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      initializeRedux({ mainWindowStats, menuOptions });
      start();
      window.Signal.Services.initializeNetworkObserver(
        window.reduxActions.network
      );
      window.Signal.Services.initializeUpdateListener(
        window.reduxActions.updates
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

  function initializeRedux({
    mainWindowStats,
    menuOptions,
  }: {
    mainWindowStats: MainWindowStatsType;
    menuOptions: MenuOptionsType;
  }) {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();
    const initialState = getInitialState({
      badges: initialBadgesState,
      mainWindowStats,
      menuOptions,
      stories: getStoriesForRedux(),
      storyDistributionLists: getDistributionListsForRedux(),
    });

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
      audioRecorder: bindActionCreators(
        actionCreators.audioRecorder,
        store.dispatch
      ),
      badges: bindActionCreators(actionCreators.badges, store.dispatch),
      calling: bindActionCreators(actionCreators.calling, store.dispatch),
      composer: bindActionCreators(actionCreators.composer, store.dispatch),
      conversations: bindActionCreators(
        actionCreators.conversations,
        store.dispatch
      ),
      crashReports: bindActionCreators(
        actionCreators.crashReports,
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
      stories: bindActionCreators(actionCreators.stories, store.dispatch),
      storyDistributionLists: bindActionCreators(
        actionCreators.storyDistributionLists,
        store.dispatch
      ),
      toast: bindActionCreators(actionCreators.toast, store.dispatch),
      updates: bindActionCreators(actionCreators.updates, store.dispatch),
      user: bindActionCreators(actionCreators.user, store.dispatch),
    };

    const {
      conversationAdded,
      conversationChanged,
      conversationRemoved,
      removeAllConversations,
    } = window.reduxActions.conversations;

    convoCollection.on('remove', conversation => {
      const { id } = conversation || {};

      conversation.trigger('unload', 'removed');
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
        log.info(
          'changedConvoBatcher: deduped ' +
            `${batch.length} into ${deduped.size}`
        );

        batchDispatch(() => {
          deduped.forEach(conversation => {
            conversationChanged(conversation.id, conversation.format());
          });
        });
      },

      // This delay ensures that the .format() call isn't synchronous as a
      //   Backbone property is changed. Important because our _byUuid/_byE164
      //   lookups aren't up-to-date as the change happens; just a little bit
      //   after.
      wait: 1,
      maxSize: Infinity,
    });

    convoCollection.on('props-change', (conversation, isBatched) => {
      if (!conversation) {
        return;
      }

      // `isBatched` is true when the `.set()` call on the conversation model
      // already runs from within `react-redux`'s batch. Instead of batching
      // the redux update for later - clear all queued updates and update
      // immediately.
      if (isBatched) {
        changedConvoBatcher.removeAll(conversation);
        conversationChanged(conversation.id, conversation.format());
        return;
      }

      changedConvoBatcher.add(conversation);
    });
    convoCollection.on('reset', removeAllConversations);

    window.Whisper.events.on('userChanged', (reconnect = false) => {
      const newDeviceId = window.textsecure.storage.user.getDeviceId();
      const newNumber = window.textsecure.storage.user.getNumber();
      const newACI = window.textsecure.storage.user
        .getUuid(UUIDKind.ACI)
        ?.toString();
      const newPNI = window.textsecure.storage.user
        .getUuid(UUIDKind.PNI)
        ?.toString();
      const ourConversation =
        window.ConversationController.getOurConversation();

      if (ourConversation?.get('e164') !== newNumber) {
        ourConversation?.set('e164', newNumber);
      }

      window.reduxActions.user.userChanged({
        ourConversationId: ourConversation?.get('id'),
        ourDeviceId: newDeviceId,
        ourNumber: newNumber,
        ourACI: newACI,
        ourPNI: newPNI,
        regionCode: window.storage.get('regionCode'),
      });

      if (reconnect) {
        log.info('background: reconnecting websocket on user change');
        enqueueReconnectToWebSocket();
      }
    });

    window.Whisper.events.on(
      'setWindowStats',
      ({
        isFullScreen,
        isMaximized,
      }: {
        isFullScreen: boolean;
        isMaximized: boolean;
      }) => {
        window.reduxActions.user.userChanged({
          isMainWindowMaximized: isMaximized,
          isMainWindowFullScreen: isFullScreen,
        });
      }
    );

    window.Whisper.events.on('setMenuOptions', (options: MenuOptionsType) => {
      window.reduxActions.user.userChanged({ menuOptions: options });
    });

    let shortcutGuideView: ReactWrapperView | null = null;

    window.showKeyboardShortcuts = () => {
      if (!shortcutGuideView) {
        shortcutGuideView = new ReactWrapperView({
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
      const { ctrlKey, metaKey, shiftKey } = event;

      const commandKey = window.platform === 'darwin' && metaKey;
      const controlKey = window.platform !== 'darwin' && ctrlKey;
      const commandOrCtrl = commandKey || controlKey;

      const state = store.getState();
      const selectedId = state.conversations.selectedConversationId;
      const conversation = window.ConversationController.get(selectedId);

      const key = KeyboardLayout.lookup(event);

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
          document.querySelector('.LeftPaneSearchInput__input'),
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

          // Search box wants to handle events internally
          if (className.includes('LeftPaneSearchInput__input')) {
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

        const lightBox = document.querySelector('.Lightbox');
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

        const reactionPicker = document.querySelector('.module-ReactionPicker');
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

      // Begin recording voice note - handled by component

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
        showToast(ToastConversationArchived, {
          undo: () => {
            conversation.setArchived(false);
            window.Whisper.events.trigger(
              'showConversation',
              conversation.get('id')
            );
          },
        });

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
        showToast(ToastConversationUnarchived);

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
        window.reduxActions.conversations.showConversation({
          conversationId: undefined,
          messageId: undefined,
        });
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
      // hooks/useKeyboardShorcuts useAttachFileShortcut

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
    log.info('powerMonitor: suspend');
    suspendTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorResume', () => {
    log.info('powerMonitor: resume');
    server?.checkSockets();
    resumeTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorLockScreen', () => {
    window.reduxActions.calling.hangUpActiveCall();
  });

  const reconnectToWebSocketQueue = new LatestQueue();

  const enqueueReconnectToWebSocket = () => {
    reconnectToWebSocketQueue.add(async () => {
      if (!server) {
        log.info('reconnectToWebSocket: No server. Early return.');
        return;
      }

      log.info('reconnectToWebSocket starting...');
      await server.onOffline();
      await server.onOnline();
      log.info('reconnectToWebSocket complete.');
    });
  };

  window.Whisper.events.on(
    'mightBeUnlinked',
    window._.debounce(enqueueReconnectToWebSocket, 1000, { maxWait: 5000 })
  );

  window.Whisper.events.on('unlinkAndDisconnect', () => {
    unlinkAndDisconnect(RemoveAllConfiguration.Full);
  });

  async function runStorageService() {
    window.Signal.Services.enableStorageService();

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'background/runStorageService: We are primary device; not sending key sync request'
      );
      return;
    }

    try {
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
    } catch (error) {
      log.error(
        'runStorageService: Failed to queue sync message',
        Errors.toLogFormat(error)
      );
    }
  }

  async function start() {
    // Storage is ready because `start()` is called from `storage.onready()`

    strictAssert(challengeHandler, 'start: challengeHandler');
    await challengeHandler.load();

    if (!window.storage.user.getNumber()) {
      const ourConversation =
        window.ConversationController.getOurConversation();
      const ourE164 = ourConversation?.get('e164');
      if (ourE164) {
        log.warn('Restoring E164 from our conversation');
        window.storage.user.setNumber(ourE164);
      }
    }

    if (newVersion && lastVersion) {
      if (window.isBeforeVersion(lastVersion, 'v5.31.0')) {
        window.ConversationController.repairPinnedConversations();
      }
    }

    window.dispatchEvent(new Event('storage_ready'));

    badgeImageFileDownloader.checkForFilesToDownload();

    log.info('Expiration start timestamp cleanup: starting...');
    const messagesUnexpectedlyMissingExpirationStartTimestamp =
      await window.Signal.Data.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
    log.info(
      `Expiration start timestamp cleanup: Found ${messagesUnexpectedlyMissingExpirationStartTimestamp.length} messages for cleanup`
    );
    if (!window.textsecure.storage.user.getUuid()) {
      log.info(
        "Expiration start timestamp cleanup: Cancelling update; we don't have our own UUID"
      );
    } else if (messagesUnexpectedlyMissingExpirationStartTimestamp.length) {
      const newMessageAttributes =
        messagesUnexpectedlyMissingExpirationStartTimestamp.map(message => {
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
          log.info(
            `Expiration start timestamp cleanup: starting timer for ${message.type} message sent at ${message.sent_at}. Starting timer at ${expirationStartTimestamp}`
          );
          return {
            ...message,
            expirationStartTimestamp,
          };
        });

      await window.Signal.Data.saveMessages(newMessageAttributes, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    }
    log.info('Expiration start timestamp cleanup: complete');

    log.info('listening for registration events');
    window.Whisper.events.on('registration_done', () => {
      log.info('handling registration event');

      strictAssert(server !== undefined, 'WebAPI not ready');
      server.authenticate(
        window.textsecure.storage.user.getWebAPICredentials()
      );
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

    startTimeTravelDetector(() => {
      window.Whisper.events.trigger('timetravel');
    });

    expiringMessagesDeletionService.update();
    tapToViewMessagesDeletionService.update();
    window.Whisper.events.on('timetravel', () => {
      expiringMessagesDeletionService.update();
      tapToViewMessagesDeletionService.update();
    });

    const isCoreDataValid = Boolean(
      window.textsecure.storage.user.getUuid() &&
        window.ConversationController.getOurConversation()
    );

    if (isCoreDataValid && window.Signal.Util.Registration.everDone()) {
      connect();
      window.reduxActions.app.openInbox();
    } else {
      window.reduxActions.app.openInstaller();
    }

    const { activeWindowService } = window.SignalContext;

    activeWindowService.registerForActive(() => notificationService.clear());
    window.addEventListener('unload', () => notificationService.fastClear());

    notificationService.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        window.Whisper.events.trigger('showConversation', id, messageId);
      } else {
        window.reduxActions.app.openInbox();
      }
    });

    // Maybe refresh remote configuration when we become active
    activeWindowService.registerForActive(async () => {
      strictAssert(server !== undefined, 'WebAPI not ready');

      try {
        await window.Signal.RemoteConfig.maybeRefreshRemoteConfig(server);
      } catch (error) {
        if (error instanceof HTTPError) {
          log.warn(
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
        const remoteBuildExpirationTimestamp =
          window.Signal.Util.parseRemoteClientExpiration(value as string);
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

    if (resolveOnAppView) {
      resolveOnAppView();
      resolveOnAppView = undefined;
    }
  }

  window.getSyncRequest = (timeoutMillis?: number) => {
    strictAssert(messageReceiver, 'MessageReceiver not initialized');

    const syncRequest = new window.textsecure.SyncRequest(
      messageReceiver,
      timeoutMillis
    );
    syncRequest.start();
    return syncRequest;
  };

  let disconnectTimer: Timers.Timeout | undefined;
  let reconnectTimer: Timers.Timeout | undefined;
  function onOffline() {
    log.info('offline');

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = Timers.setTimeout(disconnect, 1000);

    if (challengeHandler) {
      challengeHandler.onOffline();
    }
  }

  function onOnline() {
    log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
      log.warn('Already online. Had a blip in online/offline status.');
      Timers.clearTimeout(disconnectTimer);
      disconnectTimer = undefined;
      return;
    }
    if (disconnectTimer) {
      Timers.clearTimeout(disconnectTimer);
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
    log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = undefined;

    AttachmentDownloads.stop();
    if (server !== undefined) {
      strictAssert(
        messageReceiver !== undefined,
        'WebAPI should be initialized together with MessageReceiver'
      );
      await server.onOffline();
      await messageReceiver.drain();
    }
  }

  // When true - we are running the very first storage and contact sync after
  // linking.
  let isInitialSync = false;

  let connectCount = 0;
  let connecting = false;
  async function connect(firstRun?: boolean) {
    if (connecting) {
      log.warn('connect already running', { connectCount });
      return;
    }

    strictAssert(server !== undefined, 'WebAPI not connected');

    try {
      connecting = true;

      // Reset the flag and update it below if needed
      isInitialSync = false;

      log.info('connect', { firstRun, connectCount });

      if (reconnectTimer) {
        Timers.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }

      // Bootstrap our online/offline detection, only the first time we connect
      if (connectCount === 0 && navigator.onLine) {
        window.addEventListener('offline', onOffline);
      }
      if (connectCount === 0 && !navigator.onLine) {
        log.warn(
          'Starting up offline; will connect when we have network access'
        );
        window.addEventListener('online', onOnline);
        onEmpty(); // this ensures that the loading screen is dismissed

        // Switch to inbox view even if contact sync is still running
        if (
          window.reduxStore.getState().app.appView === AppViewType.Installer
        ) {
          log.info('firstRun: offline, opening inbox');
          window.reduxActions.app.openInbox();
        } else {
          log.info('firstRun: offline, not opening inbox');
        }
        return;
      }

      if (!window.Signal.Util.Registration.everDone()) {
        return;
      }

      window.textsecure.messaging = new window.textsecure.MessageSender(server);

      // Update our profile key in the conversation if we just got linked.
      const profileKey = await ourProfileKeyService.get();
      if (firstRun && profileKey) {
        const me = window.ConversationController.getOurConversation();
        strictAssert(me !== undefined, "Didn't find newly created ourselves");
        await me.setProfileKey(Bytes.toBase64(profileKey));
      }

      if (connectCount === 0) {
        try {
          // Force a re-fetch before we process our queue. We may want to turn on
          //   something which changes how we process incoming messages!
          await window.Signal.RemoteConfig.refreshRemoteConfig(server);

          const expiration = window.Signal.RemoteConfig.getValue(
            'desktop.clientExpiration'
          );
          if (expiration) {
            const remoteBuildExpirationTimestamp =
              window.Signal.Util.parseRemoteClientExpiration(
                expiration as string
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
        } catch (error) {
          log.error(
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
          log.error(
            'connect: Error fetching UUIDs for lonely e164s:',
            error && error.stack ? error.stack : error
          );
        }
      }

      connectCount += 1;

      // To avoid a flood of operations before we catch up, we pause some queues.
      profileKeyResponseQueue.pause();
      lightSessionResetQueue.pause();
      onDecryptionErrorQueue.pause();
      onRetryRequestQueue.pause();
      window.Whisper.deliveryReceiptQueue.pause();
      notificationService.disable();

      window.Signal.Services.initializeGroupCredentialFetcher();

      strictAssert(server !== undefined, 'WebAPI not initialized');
      strictAssert(
        messageReceiver !== undefined,
        'MessageReceiver not initialized'
      );
      messageReceiver.reset();
      server.registerRequestHandler(messageReceiver);

      // If coming here after `offline` event - connect again.
      await server.onOnline();

      AttachmentDownloads.start({
        logger: log,
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
        log.info('Boot after upgrading. Requesting contact sync');
        window.getSyncRequest();

        runStorageService();

        try {
          const manager = window.getAccountManager();
          await Promise.all([
            manager.maybeUpdateDeviceName(),
            window.textsecure.storage.user.removeSignalingKey(),
          ]);
        } catch (e) {
          log.error(
            'Problem with account manager updates after starting new version: ',
            e && e.stack ? e.stack : e
          );
        }
      }

      const udSupportKey = 'hasRegisterSupportForUnauthenticatedDelivery';
      if (!window.storage.get(udSupportKey)) {
        try {
          await server.registerSupportForUnauthenticatedDelivery();
          window.storage.put(udSupportKey, true);
        } catch (error) {
          log.error(
            'Error: Unable to register for unauthenticated delivery support.',
            error && error.stack ? error.stack : error
          );
        }
      }

      const deviceId = window.textsecure.storage.user.getDeviceId();

      if (!window.textsecure.storage.user.getUuid()) {
        log.error('UUID not captured during registration, unlinking');
        return unlinkAndDisconnect(RemoveAllConfiguration.Full);
      }

      if (connectCount === 1) {
        try {
          // Note: we always have to register our capabilities all at once, so we do this
          //   after connect on every startup
          await Promise.all([
            server.registerCapabilities({
              announcementGroup: true,
              giftBadges: true,
              'gv2-3': true,
              'gv1-migration': true,
              senderKey: true,
              changeNumber: true,
              stories: true,
            }),
            updateOurUsernameAndPni(),
          ]);
        } catch (error) {
          log.error(
            'Error: Unable to register our capabilities.',
            error && error.stack ? error.stack : error
          );
        }
      }

      if (!window.textsecure.storage.user.getUuid(UUIDKind.PNI)) {
        log.error('PNI not captured during registration, unlinking softly');
        return unlinkAndDisconnect(RemoveAllConfiguration.Soft);
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
          themeChanged();
        }

        const waitForEvent = createTaskWithTimeout(
          (event: string): Promise<void> => {
            const { promise, resolve } = explodePromise<void>();
            window.Whisper.events.once(event, () => resolve());
            return promise;
          },
          'firstRun:waitForEvent'
        );

        let storageServiceSyncComplete: Promise<void>;
        if (window.ConversationController.areWePrimaryDevice()) {
          storageServiceSyncComplete = Promise.resolve();
        } else {
          storageServiceSyncComplete = waitForEvent(
            'storageService:syncComplete'
          );
        }

        const contactSyncComplete = waitForEvent('contactSync:complete');

        log.info('firstRun: requesting initial sync');
        isInitialSync = true;

        // Request configuration, block, GV1 sync messages, contacts
        // (only avatars and inboxPosition),and Storage Service sync.
        try {
          await Promise.all([
            singleProtoJobQueue.add(
              MessageSender.getRequestConfigurationSyncMessage()
            ),
            singleProtoJobQueue.add(MessageSender.getRequestBlockSyncMessage()),
            singleProtoJobQueue.add(MessageSender.getRequestGroupSyncMessage()),
            singleProtoJobQueue.add(
              MessageSender.getRequestContactSyncMessage()
            ),
            runStorageService(),
          ]);
        } catch (error) {
          log.error(
            'connect: Failed to request initial syncs',
            Errors.toLogFormat(error)
          );
        }

        log.info('firstRun: waiting for storage service and contact sync');

        try {
          await Promise.all([storageServiceSyncComplete, contactSyncComplete]);
        } catch (error) {
          log.error(
            'connect: Failed to run storage service and contact syncs',
            Errors.toLogFormat(error)
          );
        }

        log.info('firstRun: initial sync complete');
        isInitialSync = false;

        // Switch to inbox view even if contact sync is still running
        if (
          window.reduxStore.getState().app.appView === AppViewType.Installer
        ) {
          log.info('firstRun: opening inbox');
          window.reduxActions.app.openInbox();
        } else {
          log.info('firstRun: not opening inbox');
        }

        const installedStickerPacks = Stickers.getInstalledStickerPacks();
        if (installedStickerPacks.length) {
          const operations = installedStickerPacks.map(pack => ({
            packId: pack.id,
            packKey: pack.key,
            installed: true,
          }));

          if (window.ConversationController.areWePrimaryDevice()) {
            log.warn(
              'background/connect: We are primary device; not sending sticker pack sync'
            );
            return;
          }

          log.info('firstRun: requesting stickers', operations.length);
          try {
            await singleProtoJobQueue.add(
              MessageSender.getStickerPackSync(operations)
            );
          } catch (error) {
            log.error(
              'connect: Failed to queue sticker sync message',
              Errors.toLogFormat(error)
            );
          }
        }

        log.info('firstRun: done');
      }

      window.storage.onready(async () => {
        idleDetector.start();
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

  window.SignalContext.nativeThemeListener.subscribe(themeChanged);

  const FIVE_MINUTES = 5 * durations.MINUTE;

  // Note: once this function returns, there still might be messages being processed on
  //   a given conversation's queue. But we have processed all events from the websocket.
  async function waitForEmptyEventQueue() {
    if (!messageReceiver) {
      log.info(
        'waitForEmptyEventQueue: No messageReceiver available, returning early'
      );
      return;
    }

    if (!messageReceiver.hasEmptied()) {
      log.info(
        'waitForEmptyEventQueue: Waiting for MessageReceiver empty event...'
      );
      const { resolve, reject, promise } = explodePromise<void>();

      const timeout = Timers.setTimeout(() => {
        reject(new Error('Empty queue never fired'));
      }, FIVE_MINUTES);

      const onEmptyOnce = () => {
        if (messageReceiver) {
          messageReceiver.removeEventListener('empty', onEmptyOnce);
        }
        Timers.clearTimeout(timeout);
        if (resolve) {
          resolve();
        }
      };
      messageReceiver.addEventListener('empty', onEmptyOnce);

      await promise;
    }

    log.info('waitForEmptyEventQueue: Waiting for event handler queue idle...');
    await eventHandlerQueue.onIdle();
  }

  window.waitForEmptyEventQueue = waitForEmptyEventQueue;

  async function onEmpty() {
    const { storage } = window.textsecure;

    await Promise.all([
      window.waitForAllBatchers(),
      window.flushAllWaitBatchers(),
    ]);
    log.info('onEmpty: All outstanding database requests complete');
    window.readyForUpdates();
    window.ConversationController.onEmpty();

    // Start listeners here, after we get through our queue.
    RotateSignedPreKeyListener.init(window.Whisper.events, newVersion);

    // Go back to main process before processing delayed actions
    await window.Signal.Data.goBackToMainProcess();

    profileKeyResponseQueue.start();
    lightSessionResetQueue.start();
    onDecryptionErrorQueue.start();
    onRetryRequestQueue.start();
    window.Whisper.deliveryReceiptQueue.start();
    notificationService.enable();

    await onAppView;

    window.reduxActions.app.initialLoadComplete();

    const processedCount = messageReceiver?.getAndResetProcessedCount() || 0;
    window.logAppLoadedEvent?.({
      processedCount,
    });
    if (messageReceiver) {
      log.info('App loaded - messages:', processedCount);
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
    log.info(
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
    await window.Signal.Data.saveMessages(messagesToSave, {
      ourUuid: storage.user.getCheckedUuid().toString(),
    });

    // Process crash reports if any
    window.reduxActions.crashReports.setCrashReportCount(
      await window.crashReports.getCount()
    );

    // Kick off a profile refresh if necessary, but don't wait for it, as failure is
    //   tolerable.
    if (!routineProfileRefresher) {
      routineProfileRefresher = new RoutineProfileRefresher({
        getAllConversations: () => window.ConversationController.getAll(),
        getOurConversationId: () =>
          window.ConversationController.getOurConversationId(),
        storage,
      });

      routineProfileRefresher.start();
    }

    // Make sure we have the PNI identity

    const pni = storage.user.getCheckedUuid(UUIDKind.PNI);
    const pniIdentity = await storage.protocol.getIdentityKeyPair(pni);
    if (!pniIdentity) {
      log.info('Requesting PNI identity sync');
      await singleProtoJobQueue.add(
        MessageSender.getRequestPniIdentitySyncMessage()
      );
    }
  }

  let initialStartupCount = 0;
  window.Whisper.events.on('incrementProgress', incrementProgress);
  function incrementProgress() {
    initialStartupCount += 1;

    // Only update progress every 10 items
    if (initialStartupCount % 10 !== 0) {
      return;
    }

    log.info(`incrementProgress: Message count is ${initialStartupCount}`);

    window.Whisper.events.trigger('loadingProgress', initialStartupCount);
  }

  window.Whisper.events.on('manualConnect', manualConnect);
  function manualConnect() {
    if (isSocketOnline()) {
      log.info('manualConnect: already online; not connecting again');
      return;
    }

    log.info('manualConnect: calling connect()');
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

    const senderConversation = window.ConversationController.maybeMergeContacts(
      {
        e164: sender,
        aci: senderUuid,
        reason: `onTyping(${typing.timestamp})`,
      }
    );

    // We multiplex between GV1/GV2 groups here, but we don't kick off migrations
    if (groupV2Id) {
      conversation = window.ConversationController.get(groupV2Id);
    }
    if (!conversation && groupId) {
      conversation = window.ConversationController.get(groupId);
    }
    if (!groupV2Id && !groupId && senderConversation) {
      conversation = senderConversation;
    }

    const ourId = window.ConversationController.getOurConversationId();

    if (!senderConversation) {
      log.warn('onTyping: maybeMergeContacts returned falsey sender!');
      return;
    }
    if (!ourId) {
      log.warn("onTyping: Couldn't get our own id!");
      return;
    }
    if (!conversation) {
      log.warn(
        `onTyping: Did not find conversation for typing indicator (groupv2(${groupV2Id}), group(${groupId}), ${sender}, ${senderUuid})`
      );
      return;
    }

    const ourACI = window.textsecure.storage.user.getUuid(UUIDKind.ACI);
    const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);

    // We drop typing notifications in groups we're not a part of
    if (
      !isDirectConversation(conversation.attributes) &&
      !(ourACI && conversation.hasMember(ourACI)) &&
      !(ourPNI && conversation.hasMember(ourPNI))
    ) {
      log.warn(
        `Received typing indicator for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
      );
      return;
    }
    if (conversation?.isBlocked()) {
      log.info(
        `onTyping: conversation ${conversation.idForLogging()} is blocked, dropping typing message`
      );
      return;
    }
    if (!senderConversation) {
      log.warn('onTyping: No conversation for sender!');
      return;
    }
    if (senderConversation.isBlocked()) {
      log.info(
        `onTyping: sender ${conversation.idForLogging()} is blocked, dropping typing message`
      );
      return;
    }

    const senderId = senderConversation.id;
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
        log.warn('Received malformed sticker pack operation sync message');
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
    log.info('onContactSyncComplete');
    await window.storage.put('synced_at', Date.now());
    window.Whisper.events.trigger('contactSync:complete');
  }

  // Note: Like the handling for incoming/outgoing messages, this method is synchronous,
  //   deferring its async logic to the function passed to conversation.queueJob().
  function onContactReceived(ev: ContactEvent) {
    const details = ev.contactDetails;

    const partialConversation: ValidateConversationType = {
      e164: details.number,
      uuid: UUID.cast(details.uuid),
      type: 'private',
    };

    const validationError = validateConversation(partialConversation);
    if (validationError) {
      log.error(
        'Invalid contact received:',
        Errors.toLogFormat(validationError)
      );
      return;
    }

    const conversation = window.ConversationController.maybeMergeContacts({
      e164: details.number,
      aci: details.uuid,
      reason: 'onContactReceived',
    });
    strictAssert(conversation, 'need conversation to queue the job!');

    // It's important to use queueJob here because we might update the expiration timer
    //   and we don't want conflicts with incoming message processing happening on the
    //   conversation queue.
    conversation.queueJob('onContactReceived', async () => {
      try {
        conversation.set({
          name: details.name,
          inbox_position: details.inboxPosition,
        });

        // Update the conversation avatar only if new avatar exists and hash differs
        const { avatar } = details;
        if (avatar && avatar.data) {
          const newAttributes = await Conversation.maybeUpdateAvatar(
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

        // expireTimer isn't in Storage Service so we have to rely on contact sync.
        const { expireTimer } = details;
        const isValidExpireTimer = typeof expireTimer === 'number';
        if (isValidExpireTimer) {
          await conversation.updateExpirationTimer(expireTimer, {
            source: window.ConversationController.getOurConversationId(),
            receivedAt: ev.receivedAtCounter,
            fromSync: true,
            isInitialSync,
            reason: 'contact sync',
          });
        }

        window.Whisper.events.trigger('incrementProgress');
      } catch (error) {
        log.error('onContactReceived error:', Errors.toLogFormat(error));
      }
    });
  }

  async function onGroupSyncComplete() {
    log.info('onGroupSyncComplete');
    await window.storage.put('synced_at', Date.now());
  }

  // Note: this handler is only for v1 groups received via 'group sync' messages
  async function onGroupReceived(ev: GroupEvent) {
    const details = ev.groupDetails;
    const { id } = details;

    const conversation = await window.ConversationController.getOrCreateAndWait(
      id,
      'group'
    );
    if (isGroupV2(conversation.attributes)) {
      log.warn('Got group sync for v2 group: ', conversation.idForLogging());
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
      const newAttributes = await Conversation.maybeUpdateAvatar(
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

    const { expireTimer } = details;
    const isValidExpireTimer = typeof expireTimer === 'number';
    if (!isValidExpireTimer) {
      return;
    }

    await conversation.updateExpirationTimer(expireTimer, {
      fromSync: true,
      receivedAt: ev.receivedAtCounter,
      source: window.ConversationController.getOurConversationId(),
      reason: 'group sync',
    });
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
          log.error('respondWithProfileKeyBatcher error', error && error.stack);
        }

        sender.queueJob('sendProfileKeyUpdate', () =>
          sender.sendProfileKeyUpdate()
        );
      });
    },

    wait: 200,
    maxSize: Infinity,
  });

  function onEnvelopeReceived({ envelope }: EnvelopeEvent) {
    const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
    if (envelope.sourceUuid && envelope.sourceUuid !== ourUuid) {
      window.ConversationController.maybeMergeContacts({
        e164: envelope.source,
        aci: envelope.sourceUuid,
        reason: `onEnvelopeReceived(${envelope.timestamp})`,
      });
    }
  }

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  function onMessageReceived(event: MessageEvent) {
    const { data, confirm } = event;

    const messageDescriptor = getMessageDescriptor({
      confirm,
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
      !message.get('unidentifiedDeliveryReceived')
    ) {
      const sender = getContact(message.attributes);

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

      const { reaction, timestamp } = data.message;

      if (!isValidReactionEmoji(reaction.emoji)) {
        log.warn('Received an invalid reaction emoji. Dropping it');
        confirm();
        return Promise.resolve();
      }

      strictAssert(
        reaction.targetTimestamp,
        'Reaction without targetTimestamp'
      );
      const fromConversation = window.ConversationController.lookupOrCreate({
        e164: data.source,
        uuid: data.sourceUuid,
      });
      strictAssert(fromConversation, 'Reaction without fromConversation');

      log.info('Queuing incoming reaction for', reaction.targetTimestamp);
      const attributes: ReactionAttributesType = {
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp,
        fromId: fromConversation.id,
        source: ReactionSource.FromSomeoneElse,
      };
      const reactionModel = Reactions.getSingleton().add(attributes);

      // Note: We do not wait for completion here
      Reactions.getSingleton().onReaction(reactionModel, message);
      confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      log.info('Queuing incoming DOE for', del.targetSentTimestamp);

      strictAssert(
        del.targetSentTimestamp,
        'Delete missing targetSentTimestamp'
      );
      strictAssert(data.serverTimestamp, 'Delete missing serverTimestamp');
      const fromConversation = window.ConversationController.lookupOrCreate({
        e164: data.source,
        uuid: data.sourceUuid,
      });
      strictAssert(fromConversation, 'Delete missing fromConversation');

      const attributes: DeleteAttributesType = {
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: fromConversation.id,
      };
      const deleteModel = Deletes.getSingleton().add(attributes);

      // Note: We do not wait for completion here
      Deletes.getSingleton().onDelete(deleteModel);

      confirm();
      return Promise.resolve();
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      confirm();
      return Promise.resolve();
    }

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    message.handleDataMessage(data.message, event.confirm);

    return Promise.resolve();
  }

  async function onProfileKeyUpdate({ data, confirm }: ProfileKeyUpdateEvent) {
    const conversation = window.ConversationController.maybeMergeContacts({
      aci: data.sourceUuid,
      e164: data.source,
      reason: 'onProfileKeyUpdate',
    });

    if (!conversation) {
      log.error(
        'onProfileKeyUpdate: could not find conversation',
        data.source,
        data.sourceUuid
      );
      confirm();
      return;
    }

    if (!data.profileKey) {
      log.error('onProfileKeyUpdate: missing profileKey', data.profileKey);
      confirm();
      return;
    }

    log.info(
      'onProfileKeyUpdate: updating profileKey for',
      data.sourceUuid,
      data.source
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

    const sendStateByConversationId: SendStateByConversationId =
      unidentifiedStatus.reduce(
        (
          result: SendStateByConversationId,
          { destinationUuid, destination, isAllowedToReplyToStory }
        ) => {
          const conversation = window.ConversationController.lookupOrCreate({
            uuid: destinationUuid,
            e164: destination,
          });
          if (!conversation || conversation.id === ourId) {
            return result;
          }

          return {
            ...result,
            [conversation.id]: {
              isAllowedToReplyToStory,
              status: SendStatus.Sent,
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

    const partialMessage: MessageAttributesType = {
      id: UUID.generate().toString(),
      canReplyToStory: data.message.isStory
        ? data.message.canReplyToStory
        : undefined,
      conversationId: descriptor.id,
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || timestamp,
        now
      ),
      readStatus: ReadStatus.Read,
      received_at_ms: data.receivedAtDate,
      received_at: data.receivedAtCounter,
      seenStatus: SeenStatus.NotApplicable,
      sendStateByConversationId,
      sent_at: timestamp,
      serverTimestamp: data.serverTimestamp,
      source: window.textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sourceUuid: window.textsecure.storage.user.getUuid()?.toString(),
      timestamp,
      type: data.message.isStory ? 'story' : 'outgoing',
      storyDistributionListId: data.storyDistributionListId,
      unidentifiedDeliveries,
    };

    return new window.Whisper.Message(partialMessage);
  }

  // Works with 'sent' and 'message' data sent from MessageReceiver, with a little massage
  //   at callsites to make sure both source and destination are populated.
  const getMessageDescriptor = ({
    confirm,
    message,
    source,
    sourceUuid,
    destination,
    destinationUuid,
  }: {
    confirm: () => unknown;
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
        log.warn(
          'getMessageDescriptor: GroupV1 data was missing derivedGroupV2Id'
        );
      } else {
        // First we check for an already-migrated GroupV2 group
        const migratedGroup =
          window.ConversationController.get(derivedGroupV2Id);
        if (migratedGroup) {
          return {
            type: Message.GROUP,
            id: migratedGroup.id,
          };
        }
      }

      // If we can't find one, we treat this as a normal GroupV1 group
      const fromContact = window.ConversationController.maybeMergeContacts({
        aci: sourceUuid,
        e164: source,
        reason: `getMessageDescriptor(${message.timestamp}): group v1`,
      });

      const conversationId = window.ConversationController.ensureGroup(id, {
        addedBy: fromContact?.id,
      });

      return {
        type: Message.GROUP,
        id: conversationId,
      };
    }

    const conversation = window.ConversationController.maybeMergeContacts({
      aci: destinationUuid,
      e164: destination,
      reason: `getMessageDescriptor(${message.timestamp}): private`,
    });
    if (!conversation) {
      confirm();
      throw new Error(
        `getMessageDescriptor/${message.timestamp}: maybeMergeContacts returned falsey conversation`
      );
    }

    return {
      type: Message.PRIVATE,
      id: conversation.id,
    };
  };

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  function onSentMessage(event: SentEvent) {
    const { data, confirm } = event;

    const source = window.textsecure.storage.user.getNumber();
    const sourceUuid = window.textsecure.storage.user.getUuid()?.toString();
    strictAssert(source && sourceUuid, 'Missing user number and uuid');

    const messageDescriptor = getMessageDescriptor({
      confirm,
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

      const { reaction, timestamp } = data.message;
      strictAssert(
        reaction.targetTimestamp,
        'Reaction without targetAuthorUuid'
      );

      if (!isValidReactionEmoji(reaction.emoji)) {
        log.warn('Received an invalid reaction emoji. Dropping it');
        event.confirm();
        return Promise.resolve();
      }

      log.info('Queuing sent reaction for', reaction.targetTimestamp);
      const attributes: ReactionAttributesType = {
        emoji: reaction.emoji,
        remove: reaction.remove,
        targetAuthorUuid,
        targetTimestamp: reaction.targetTimestamp,
        timestamp,
        fromId: window.ConversationController.getOurConversationIdOrThrow(),
        source: ReactionSource.FromSync,
      };
      const reactionModel = Reactions.getSingleton().add(attributes);
      // Note: We do not wait for completion here
      Reactions.getSingleton().onReaction(reactionModel, message);

      event.confirm();
      return Promise.resolve();
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      strictAssert(
        del.targetSentTimestamp,
        'Delete without targetSentTimestamp'
      );
      strictAssert(data.serverTimestamp, 'Data has no serverTimestamp');

      log.info('Queuing sent DOE for', del.targetSentTimestamp);

      const attributes: DeleteAttributesType = {
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: window.ConversationController.getOurConversationIdOrThrow(),
      };
      const deleteModel = Deletes.getSingleton().add(attributes);
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
    const partialMessage: MessageAttributesType = {
      id: UUID.generate().toString(),
      canReplyToStory: data.message.isStory
        ? data.message.canReplyToStory
        : undefined,
      conversationId: descriptor.id,
      readStatus: ReadStatus.Unread,
      received_at: data.receivedAtCounter,
      received_at_ms: data.receivedAtDate,
      seenStatus: SeenStatus.Unseen,
      sent_at: data.timestamp,
      serverGuid: data.serverGuid,
      serverTimestamp: data.serverTimestamp,
      source: data.source,
      sourceDevice: data.sourceDevice,
      sourceUuid: data.sourceUuid ? UUID.cast(data.sourceUuid) : undefined,
      timestamp: data.timestamp,
      type: data.message.isStory ? 'story' : 'incoming',
      unidentifiedDeliveryReceived: data.unidentifiedDeliveryReceived,
    };
    return new window.Whisper.Message(partialMessage);
  }

  // Returns `false` if this message isn't a group call message.
  function handleGroupCallUpdateMessage(
    message: ProcessedDataMessage,
    messageDescriptor: MessageDescriptor
  ): boolean {
    if (message.groupCallUpdate) {
      if (message.groupV2 && messageDescriptor.type === Message.GROUP) {
        window.reduxActions.calling.peekNotConnectedGroupCall({
          conversationId: messageDescriptor.id,
        });
        return true;
      }
      log.warn(
        'Received a group call update for a conversation that is not a GV2 group. Ignoring that property and continuing.'
      );
    }
    return false;
  }

  async function unlinkAndDisconnect(
    mode: RemoveAllConfiguration
  ): Promise<void> {
    window.Whisper.events.trigger('unauthorized');

    log.warn(
      'unlinkAndDisconnect: Client is no longer authorized; ' +
        'deleting local configuration'
    );

    if (messageReceiver) {
      log.info('unlinkAndDisconnect: logging out');
      strictAssert(server !== undefined, 'WebAPI not initialized');
      server.unregisterRequestHandler(messageReceiver);
      messageReceiver.stopProcessing();

      await server.logout();
      await window.waitForAllBatchers();
    }

    onEmpty();

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
      log.info(`unlinkAndDisconnect: removing configuration, mode ${mode}`);
      await window.textsecure.storage.protocol.removeAllConfiguration(mode);

      // This was already done in the database with removeAllConfiguration; this does it
      //   for all the conversation models in memory.
      window.getConversations().forEach(conversation => {
        // eslint-disable-next-line no-param-reassign
        delete conversation.attributes.senderKeyInfo;
      });

      // These two bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
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

      log.info('unlinkAndDisconnect: Successfully cleared local configuration');
    } catch (eraseError) {
      log.error(
        'unlinkAndDisconnect: Something went wrong clearing ' +
          'local configuration',
        eraseError && eraseError.stack ? eraseError.stack : eraseError
      );
    } finally {
      window.Signal.Util.Registration.markEverDone();
    }
  }

  function onError(ev: ErrorEvent) {
    const { error } = ev;
    log.error('background onError:', Errors.toLogFormat(error));

    if (
      error instanceof HTTPError &&
      (error.code === 401 || error.code === 403)
    ) {
      unlinkAndDisconnect(RemoveAllConfiguration.Full);
      return;
    }

    log.warn('background onError: Doing nothing with incoming error');
  }

  async function onViewOnceOpenSync(ev: ViewOnceOpenSyncEvent) {
    ev.confirm();

    const { source, sourceUuid, timestamp } = ev;
    log.info(`view once open sync ${source} ${timestamp}`);
    strictAssert(sourceUuid, 'ViewOnceOpen without sourceUuid');
    strictAssert(timestamp, 'ViewOnceOpen without timestamp');

    const attributes: ViewOnceOpenSyncAttributesType = {
      source,
      sourceUuid,
      timestamp,
    };
    const sync = ViewOnceOpenSyncs.getSingleton().add(attributes);

    ViewOnceOpenSyncs.getSingleton().onSync(sync);
  }

  async function onFetchLatestSync(ev: FetchLatestEvent) {
    ev.confirm();

    const { eventType } = ev;

    const FETCH_LATEST_ENUM = Proto.SyncMessage.FetchLatest.Type;

    switch (eventType) {
      case FETCH_LATEST_ENUM.LOCAL_PROFILE: {
        const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
        const ourE164 = window.textsecure.storage.user.getNumber();
        await Promise.all([
          getProfile(ourUuid, ourE164),
          updateOurUsernameAndPni(),
        ]);
        break;
      }
      case FETCH_LATEST_ENUM.STORAGE_MANIFEST:
        log.info('onFetchLatestSync: fetching latest manifest');
        await window.Signal.Services.runStorageServiceSyncJob();
        break;
      case FETCH_LATEST_ENUM.SUBSCRIPTION_STATUS:
        log.info('onFetchLatestSync: fetching latest subscription status');
        strictAssert(server, 'WebAPI not ready');
        areWeASubscriberService.update(window.storage, server);
        break;
      default:
        log.info(`onFetchLatestSync: Unknown type encountered ${eventType}`);
    }
  }

  async function onKeysSync(ev: KeysEvent) {
    ev.confirm();

    const { storageServiceKey } = ev;

    if (storageServiceKey === null) {
      log.info('onKeysSync: deleting window.storageKey');
      window.storage.remove('storageKey');
    }

    if (storageServiceKey) {
      const storageServiceKeyBase64 = Bytes.toBase64(storageServiceKey);
      if (window.storage.get('storageKey') === storageServiceKeyBase64) {
        log.info(
          "onKeysSync: storage service key didn't change, " +
            'fetching manifest anyway'
        );
      } else {
        log.info(
          'onKeysSync: updated storage service key, erasing state and fetching'
        );
        await window.storage.put('storageKey', storageServiceKeyBase64);
        await window.Signal.Services.eraseAllStorageServiceState({
          keepUnknownFields: true,
        });
      }

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

    log.info('onMessageRequestResponse', {
      threadE164,
      threadUuid,
      groupId: `group(${groupId})`,
      groupV2Id: `groupv2(${groupV2Id})`,
      messageRequestResponseType,
    });

    strictAssert(
      messageRequestResponseType,
      'onMessageRequestResponse: missing type'
    );

    const attributes: MessageRequestAttributesType = {
      threadE164,
      threadUuid,
      groupId,
      groupV2Id,
      type: messageRequestResponseType,
    };
    const sync = MessageRequests.getSingleton().add(attributes);

    MessageRequests.getSingleton().onResponse(sync);
  }

  function onReadReceipt(event: Readonly<ReadEvent>) {
    onReadOrViewReceipt({
      logTitle: 'read receipt',
      event,
      type: MessageReceiptType.Read,
    });
  }

  function onViewReceipt(event: Readonly<ViewEvent>): void {
    onReadOrViewReceipt({
      logTitle: 'view receipt',
      event,
      type: MessageReceiptType.View,
    });
  }

  function onReadOrViewReceipt({
    event,
    logTitle,
    type,
  }: Readonly<{
    event: ReadEvent | ViewEvent;
    logTitle: string;
    type: MessageReceiptType.Read | MessageReceiptType.View;
  }>): void {
    const { envelopeTimestamp, timestamp, source, sourceUuid, sourceDevice } =
      event.receipt;
    const sourceConversation = window.ConversationController.maybeMergeContacts(
      {
        aci: sourceUuid,
        e164: source,
        reason: `onReadOrViewReceipt(${envelopeTimestamp})`,
      }
    );
    log.info(
      logTitle,
      source,
      sourceUuid,
      sourceDevice,
      envelopeTimestamp,
      sourceConversation?.id,
      'for sent message',
      timestamp
    );

    event.confirm();

    if (!window.storage.get('read-receipt-setting') || !sourceConversation) {
      return;
    }

    strictAssert(
      isValidUuid(sourceUuid),
      'onReadOrViewReceipt: Missing sourceUuid'
    );
    strictAssert(sourceDevice, 'onReadOrViewReceipt: Missing sourceDevice');

    const attributes: MessageReceiptAttributesType = {
      messageSentAt: timestamp,
      receiptTimestamp: envelopeTimestamp,
      sourceConversationId: sourceConversation?.id,
      sourceUuid,
      sourceDevice,
      type,
    };
    const receipt = MessageReceipts.getSingleton().add(attributes);

    // Note: We do not wait for completion here
    MessageReceipts.getSingleton().onReceipt(receipt);
  }

  function onReadSync(ev: ReadSyncEvent) {
    const { envelopeTimestamp, sender, senderUuid, timestamp } = ev.read;
    const readAt = envelopeTimestamp;
    const senderConversation = window.ConversationController.lookupOrCreate({
      e164: sender,
      uuid: senderUuid,
    });
    const senderId = senderConversation?.id;

    log.info(
      'read sync',
      sender,
      senderUuid,
      envelopeTimestamp,
      senderId,
      'for message',
      timestamp
    );

    strictAssert(senderId, 'onReadSync missing senderId');
    strictAssert(senderUuid, 'onReadSync missing senderUuid');
    strictAssert(timestamp, 'onReadSync missing timestamp');

    const attributes: ReadSyncAttributesType = {
      senderId,
      sender,
      senderUuid,
      timestamp,
      readAt,
    };
    const receipt = ReadSyncs.getSingleton().add(attributes);

    receipt.on('remove', ev.confirm);

    // Note: Here we wait, because we want read states to be in the database
    //   before we move on.
    return ReadSyncs.getSingleton().onSync(receipt);
  }

  function onViewSync(ev: ViewSyncEvent) {
    const { envelopeTimestamp, senderE164, senderUuid, timestamp } = ev.view;
    const senderConversation = window.ConversationController.lookupOrCreate({
      e164: senderE164,
      uuid: senderUuid,
    });
    const senderId = senderConversation?.id;

    log.info(
      'view sync',
      senderE164,
      senderUuid,
      envelopeTimestamp,
      senderId,
      'for message',
      timestamp
    );

    strictAssert(senderId, 'onViewSync missing senderId');
    strictAssert(senderUuid, 'onViewSync missing senderUuid');
    strictAssert(timestamp, 'onViewSync missing timestamp');

    const attributes: ViewSyncAttributesType = {
      senderId,
      senderE164,
      senderUuid,
      timestamp,
      viewedAt: envelopeTimestamp,
    };
    const receipt = ViewSyncs.getSingleton().add(attributes);

    receipt.on('remove', ev.confirm);

    // Note: Here we wait, because we want viewed states to be in the database
    //   before we move on.
    return ViewSyncs.getSingleton().onSync(receipt);
  }

  function onDeliveryReceipt(ev: DeliveryEvent) {
    const { deliveryReceipt } = ev;
    const { envelopeTimestamp, sourceUuid, source, sourceDevice, timestamp } =
      deliveryReceipt;

    ev.confirm();

    const sourceConversation = window.ConversationController.maybeMergeContacts(
      {
        aci: sourceUuid,
        e164: source,
        reason: `onDeliveryReceipt(${envelopeTimestamp})`,
      }
    );

    log.info(
      'delivery receipt from',
      source,
      sourceUuid,
      sourceDevice,
      sourceConversation?.id,
      envelopeTimestamp,
      'for sent message',
      timestamp
    );

    if (!sourceConversation) {
      log.info('no conversation for', source, sourceUuid);
      return;
    }

    strictAssert(
      envelopeTimestamp,
      'onDeliveryReceipt: missing envelopeTimestamp'
    );
    strictAssert(
      isValidUuid(sourceUuid),
      'onDeliveryReceipt: missing valid sourceUuid'
    );
    strictAssert(sourceDevice, 'onDeliveryReceipt: missing sourceDevice');

    const attributes: MessageReceiptAttributesType = {
      messageSentAt: timestamp,
      receiptTimestamp: envelopeTimestamp,
      sourceConversationId: sourceConversation?.id,
      sourceUuid,
      sourceDevice,
      type: MessageReceiptType.Delivery,
    };
    const receipt = MessageReceipts.getSingleton().add(attributes);

    // Note: We don't wait for completion here
    MessageReceipts.getSingleton().onReceipt(receipt);
  }
}

window.startApp = startApp;
