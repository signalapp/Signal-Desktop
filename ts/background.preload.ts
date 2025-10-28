// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { createRoot } from 'react-dom/client';
import PQueue from 'p-queue';
import pMap from 'p-map';
import { v7 as generateUuid } from 'uuid';

import * as Registration from './util/registration.preload.js';
import MessageReceiver from './textsecure/MessageReceiver.preload.js';
import { signalProtocolStore } from './SignalProtocolStore.preload.js';
import type {
  SessionResetsType,
  ProcessedDataMessage,
} from './textsecure/Types.d.ts';
import { HTTPError } from './types/HTTPError.std.js';
import createTaskWithTimeout, {
  suspendTasksWithTimeout,
  resumeTasksWithTimeout,
  reportLongRunningTasks,
} from './textsecure/TaskWithTimeout.std.js';
import type { MessageAttributesType } from './model-types.d.ts';
import * as Bytes from './Bytes.std.js';
import * as Timers from './Timers.preload.js';
import * as indexedDb from './indexeddb.dom.js';
import type { MenuOptionsType } from './types/menu.std.js';
import { SocketStatus } from './types/SocketStatus.std.js';
import { DEFAULT_CONVERSATION_COLOR } from './types/Colors.std.js';
import { ThemeType } from './types/Util.std.js';
import * as durations from './util/durations/index.std.js';
import { drop } from './util/drop.std.js';
import { explodePromise } from './util/explodePromise.std.js';
import { deliveryReceiptQueue } from './util/deliveryReceipt.preload.js';
import type { ExplodePromiseResultType } from './util/explodePromise.std.js';
import { isWindowDragElement } from './util/isWindowDragElement.std.js';
import { assertDev, strictAssert } from './util/assert.std.js';
import { filter } from './util/iterables.std.js';
import { isNotNil } from './util/isNotNil.std.js';
import { areRemoteBackupsTurnedOn } from './util/isBackupEnabled.preload.js';
import { lightSessionResetQueue } from './util/lightSessionResetQueue.std.js';
import { setAppLoadingScreenMessage } from './setAppLoadingScreenMessage.dom.js';
import { IdleDetector } from './IdleDetector.preload.js';
import { challengeHandler } from './services/challengeHandler.preload.js';
import {
  initialize as initializeExpiringMessageService,
  update as updateExpiringMessagesService,
} from './services/expiringMessagesDeletion.preload.js';
import {
  initialize as initializeNotificationProfilesService,
  fastUpdate as updateNotificationProfileService,
} from './services/notificationProfilesService.preload.js';
import { tapToViewMessagesDeletionService } from './services/tapToViewMessagesDeletionService.preload.js';
import { senderCertificateService } from './services/senderCertificate.preload.js';
import {
  GROUP_CREDENTIALS_KEY,
  initializeGroupCredentialFetcher,
} from './services/groupCredentialFetcher.preload.js';
import { initializeNetworkObserver } from './services/networkObserver.preload.js';
import * as KeyboardLayout from './services/keyboardLayout.dom.js';
import * as StorageService from './services/storage.preload.js';
import { usernameIntegrity } from './services/usernameIntegrity.preload.js';
import { updateIdentityKey } from './services/profiles.preload.js';
import { initializeUpdateListener } from './services/updateListener.preload.js';
import { RoutineProfileRefresher } from './routineProfileRefresh.preload.js';
import { isOlderThan } from './util/timestamp.std.js';
import { isValidReactionEmoji } from './reactions/isValidReactionEmoji.std.js';
import { safeParsePartial } from './util/schemas.std.js';
import {
  PollVoteSchema,
  PollTerminateSchema,
  isPollReceiveEnabled,
} from './types/Polls.dom.js';
import type { ConversationModel } from './models/conversations.preload.js';
import { isIncoming } from './messages/helpers.std.js';
import { getAuthor } from './messages/sources.preload.js';
import { migrateBatchOfMessages } from './messages/migrateMessageData.preload.js';
import { createBatcher, waitForAllBatchers } from './util/batcher.std.js';
import {
  flushAllWaitBatchers,
  waitForAllWaitBatchers,
} from './util/waitBatcher.std.js';
import {
  initializeAllJobQueues,
  shutdownAllJobQueues,
} from './jobs/initializeAllJobQueues.preload.js';
import { removeStorageKeyJobQueue } from './jobs/removeStorageKeyJobQueue.preload.js';
import { conversationJobQueue } from './jobs/conversationJobQueue.preload.js';
import { ourProfileKeyService } from './services/ourProfileKey.std.js';
import { notificationService } from './services/notifications.preload.js';
import { areWeASubscriberService } from './services/areWeASubscriber.dom.js';
import {
  onContactSync,
  setIsInitialContactSync,
} from './services/contactSync.preload.js';
import { startTimeTravelDetector } from './util/startTimeTravelDetector.std.js';
import { shouldRespondWithProfileKey } from './util/shouldRespondWithProfileKey.dom.js';
import { LatestQueue } from './util/LatestQueue.std.js';
import { parseIntOrThrow } from './util/parseIntOrThrow.std.js';
import { getProfile } from './util/getProfile.preload.js';
import type {
  AttachmentBackfillResponseSyncEvent,
  ConfigurationEvent,
  DeliveryEvent,
  EnvelopeQueuedEvent,
  EnvelopeUnsealedEvent,
  ErrorEvent,
  FetchLatestEvent,
  InvalidPlaintextEvent,
  KeysEvent,
  DeleteForMeSyncEvent,
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
} from './textsecure/messageReceiverEvents.std.js';
import {
  cancelInflightRequests,
  checkSockets,
  connect as connectWebAPI,
  getConfig,
  getHasSubscription,
  getReleaseNote,
  getReleaseNoteHash,
  getReleaseNoteImageAttachment,
  getReleaseNotesManifest,
  getReleaseNotesManifestHash,
  getSenderCertificate,
  getServerAlerts,
  getSocketStatus,
  isOnline,
  logout,
  onExpiration,
  onNavigatorOffline,
  onNavigatorOnline,
  reconnect as reconnectWebAPI,
  registerCapabilities as doRegisterCapabilities,
  registerRequestHandler,
  reportMessage,
  unregisterRequestHandler,
} from './textsecure/WebAPI.preload.js';
import { accountManager } from './textsecure/AccountManager.preload.js';
import * as KeyChangeListener from './textsecure/KeyChangeListener.dom.js';
import { UpdateKeysListener } from './textsecure/UpdateKeysListener.preload.js';
import { isGroup } from './util/whatTypeOfConversation.dom.js';
import { BackOff, FIBONACCI_TIMEOUTS } from './util/BackOff.std.js';
import { createApp as createAppRoot } from './state/roots/createApp.preload.js';
import { AppViewType } from './state/ducks/app.preload.js';
import { areAnyCallsActiveOrRinging } from './state/selectors/calling.std.js';
import { badgeImageFileDownloader } from './badges/badgeImageFileDownloader.preload.js';
import * as Deletes from './messageModifiers/Deletes.preload.js';
import * as Edits from './messageModifiers/Edits.preload.js';
import * as MessageReceipts from './messageModifiers/MessageReceipts.preload.js';
import * as MessageRequests from './messageModifiers/MessageRequests.preload.js';
import * as Polls from './messageModifiers/Polls.preload.js';
import * as Reactions from './messageModifiers/Reactions.preload.js';
import * as ViewOnceOpenSyncs from './messageModifiers/ViewOnceOpenSyncs.preload.js';
import type { DeleteAttributesType } from './messageModifiers/Deletes.preload.js';
import type { EditAttributesType } from './messageModifiers/Edits.preload.js';
import type { MessageRequestAttributesType } from './messageModifiers/MessageRequests.preload.js';
import type {
  PollVoteAttributesType,
  PollTerminateAttributesType,
} from './messageModifiers/Polls.preload.js';
import type { ReactionAttributesType } from './messageModifiers/Reactions.preload.js';
import type { ViewOnceOpenSyncAttributesType } from './messageModifiers/ViewOnceOpenSyncs.preload.js';
import { ReadStatus } from './messages/MessageReadStatus.std.js';
import type { SendStateByConversationId } from './messages/MessageSendState.std.js';
import { SendStatus } from './messages/MessageSendState.std.js';
import * as Stickers from './types/Stickers.preload.js';
import * as Errors from './types/errors.std.js';
import { InstallScreenStep } from './types/InstallScreen.std.js';
import { getEnvironment } from './environment.std.js';
import { SignalService as Proto } from './protobuf/index.std.js';
import {
  getOnDecryptionError,
  onRetryRequest,
  onInvalidPlaintextMessage,
  onSuccessfulDecrypt,
} from './util/handleRetry.preload.js';
import { themeChanged } from './shims/themeChanged.dom.js';
import { createIPCEvents } from './util/createIPCEvents.preload.js';
import type { ServiceIdString } from './types/ServiceId.std.js';
import {
  ServiceIdKind,
  isPniString,
  isServiceIdString,
} from './types/ServiceId.std.js';
import { isAciString } from './util/isAciString.std.js';
import { normalizeAci } from './util/normalizeAci.std.js';
import { createLogger } from './logging/log.std.js';
import { deleteAllLogs } from './util/deleteAllLogs.preload.js';
import { startInteractionMode } from './services/InteractionMode.dom.js';
import { calling } from './services/calling.preload.js';
import { ReactionSource } from './reactions/ReactionSource.std.js';
import { singleProtoJobQueue } from './jobs/singleProtoJobQueue.preload.js';
import { SeenStatus } from './MessageSeenStatus.std.js';
import { MessageSender } from './textsecure/SendMessage.preload.js';
import { onStoryRecipientUpdate } from './util/onStoryRecipientUpdate.preload.js';
import { flushAttachmentDownloadQueue } from './util/attachmentDownloadQueue.preload.js';
import { initializeRedux } from './state/initializeRedux.preload.js';
import { StartupQueue } from './util/StartupQueue.std.js';
import { showConfirmationDialog } from './util/showConfirmationDialog.dom.js';
import { onCallEventSync } from './util/onCallEventSync.preload.js';
import { sleeper } from './util/sleeper.std.js';
import { DAY, HOUR, SECOND } from './util/durations/index.std.js';
import { copyDataMessageIntoMessage } from './util/copyDataMessageIntoMessage.std.js';
import {
  flushMessageCounter,
  incrementMessageCounter,
  initializeMessageCounter,
} from './util/incrementMessageCounter.preload.js';
import { generateMessageId } from './util/generateMessageId.node.js';
import { retryPlaceholders } from './services/retryPlaceholders.std.js';
import { setBatchingStrategy } from './util/messageBatcher.preload.js';
import { parseRemoteClientExpiration } from './util/parseRemoteClientExpiration.dom.js';
import { addGlobalKeyboardShortcuts } from './services/addGlobalKeyboardShortcuts.preload.js';
import { createEventHandler } from './quill/signal-clipboard/util.dom.js';
import { onCallLogEventSync } from './util/onCallLogEventSync.preload.js';
import { backupsService } from './services/backups/index.preload.js';
import {
  getCallIdFromEra,
  updateLocalGroupCallHistoryTimestamp,
} from './util/callDisposition.preload.js';
import { deriveStorageServiceKey, deriveMasterKey } from './Crypto.node.js';
import { AttachmentDownloadManager } from './jobs/AttachmentDownloadManager.preload.js';
import { onCallLinkUpdateSync } from './util/onCallLinkUpdateSync.preload.js';
import { CallMode } from './types/CallDisposition.std.js';
import type { SyncTaskType } from './util/syncTasks.preload.js';
import { queueSyncTasks, runAllSyncTasks } from './util/syncTasks.preload.js';
import type { ViewSyncTaskType } from './messageModifiers/ViewSyncs.preload.js';
import type { ReceiptSyncTaskType } from './messageModifiers/MessageReceipts.preload.js';
import type { ReadSyncTaskType } from './messageModifiers/ReadSyncs.preload.js';
import { AttachmentBackupManager } from './jobs/AttachmentBackupManager.preload.js';
import { getConversationIdForLogging } from './util/idForLogging.preload.js';
import { encryptConversationAttachments } from './util/encryptConversationAttachments.preload.js';
import { DataReader, DataWriter } from './sql/Client.preload.js';
import {
  restoreRemoteConfigFromStorage,
  getValue as getRemoteConfigValue,
  onChange as onRemoteConfigChange,
  maybeRefreshRemoteConfig,
  forceRefreshRemoteConfig,
} from './RemoteConfig.dom.js';
import {
  getParametersForRedux,
  loadAll,
} from './services/allLoaders.preload.js';
import { checkFirstEnvelope } from './util/checkFirstEnvelope.dom.js';
import { BLOCKED_UUIDS_ID } from './textsecure/storage/Blocked.std.js';
import { ReleaseNotesFetcher } from './services/releaseNotesFetcher.preload.js';
import { BuildExpirationService } from './services/buildExpiration.preload.js';
import {
  maybeQueueDeviceNameFetch,
  onDeviceNameChangeSync,
} from './util/onDeviceNameChangeSync.preload.js';
import { postSaveUpdates } from './util/cleanup.preload.js';
import { handleDataMessage } from './messages/handleDataMessage.preload.js';
import { MessageModel } from './models/messages.preload.js';
import { waitForEvent } from './shims/events.dom.js';
import { sendSyncRequests } from './textsecure/syncRequests.preload.js';
import { handleServerAlerts } from './util/handleServerAlerts.preload.js';
import { isLocalBackupsEnabled } from './util/isLocalBackupsEnabled.dom.js';
import { NavTab, SettingsPage, ProfileEditorPage } from './types/Nav.std.js';
import { initialize as initializeDonationService } from './services/donations.preload.js';
import { MessageRequestResponseSource } from './types/MessageRequestResponseEvent.std.js';
import {
  CURRENT_SCHEMA_VERSION,
  PRIVATE,
  GROUP,
} from './types/Message2.preload.js';
import { JobCancelReason } from './jobs/types.std.js';
import { itemStorage } from './textsecure/Storage.preload.js';

const { isNumber, throttle } = lodash;

const log = createLogger('background');
const { i18n } = window.SignalContext;

export function isOverHourIntoPast(timestamp: number): boolean {
  return isNumber(timestamp) && isOlderThan(timestamp, HOUR);
}

export async function cleanupSessionResets(): Promise<void> {
  const sessionResets = itemStorage.get(
    'sessionResets',
    {} as SessionResetsType
  );

  const keys = Object.keys(sessionResets);
  keys.forEach(key => {
    const timestamp = sessionResets[key];
    if (!timestamp || isOverHourIntoPast(timestamp)) {
      delete sessionResets[key];
    }
  });

  await itemStorage.put('sessionResets', sessionResets);
}

export async function startApp(): Promise<void> {
  if (window.initialTheme === ThemeType.light) {
    document.body.classList.add('light-theme');
  }
  if (window.initialTheme === ThemeType.dark) {
    document.body.classList.add('dark-theme');
  }

  const idleDetector = new IdleDetector();

  await KeyboardLayout.initialize();

  StartupQueue.initialize();
  notificationService.initialize({
    i18n,
    storage: itemStorage,
  });

  await initializeMessageCounter();

  // Initialize WebAPI as early as possible
  let messageReceiver: MessageReceiver | undefined;
  let routineProfileRefresher: RoutineProfileRefresher | undefined;

  ourProfileKeyService.initialize(itemStorage);

  window.SignalContext.activeWindowService.registerForChange(isActive => {
    if (!isActive) {
      window.reduxActions?.stories.setHasAllStoriesUnmuted(false);
    }
  });

  let resolveOnAppView: (() => void) | undefined;
  const onAppView = new Promise<void>(resolve => {
    resolveOnAppView = resolve;
  });

  const reconnectBackOff = new BackOff(FIBONACCI_TIMEOUTS);

  const eventHandlerQueue = new PQueue({
    concurrency: 1,
  });

  // Note: this queue is meant to allow for stop/start of tasks, not limit parallelism.
  const profileKeyResponseQueue = new PQueue();
  profileKeyResponseQueue.pause();

  const onDecryptionErrorQueue = new PQueue({ concurrency: 1 });
  onDecryptionErrorQueue.pause();

  const onRetryRequestQueue = new PQueue({ concurrency: 1 });
  onRetryRequestQueue.pause();

  if (window.platform === 'darwin') {
    window.addEventListener('dblclick', (event: Event) => {
      const target = event.target as HTMLElement;
      if (isWindowDragElement(target)) {
        window.IPC.titleBarDoubleClick();
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

  // Intercept clipboard copies to add our custom text/signal data
  document.addEventListener(
    'copy',
    createEventHandler({ deleteSelection: false })
  );
  document.addEventListener(
    'cut',
    createEventHandler({ deleteSelection: true })
  );

  startInteractionMode();

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  log.info('page reloaded');
  log.info('environment:', getEnvironment());

  let newVersion = false;
  let lastVersion: string | undefined;

  window.document.title = window.getTitle();

  document.documentElement.setAttribute(
    'lang',
    window.SignalContext.getResolvedMessagesLocale().split(/[-_]/)[0]
  );

  document.documentElement.setAttribute(
    'dir',
    window.SignalContext.getResolvedMessagesLocaleDirection()
  );

  KeyChangeListener.init(signalProtocolStore);
  signalProtocolStore.on(
    'lowKeys',
    throttle(
      async () => {
        await accountManager.maybeUpdateKeys(ServiceIdKind.ACI);
        await accountManager.maybeUpdateKeys(ServiceIdKind.PNI);
      },
      durations.MINUTE,
      { trailing: true, leading: false }
    )
  );

  signalProtocolStore.on('removeAllData', () => {
    window.reduxActions.stories.removeAllStories();
  });

  signalProtocolStore.on('nullMessage', ({ conversationId, idForTracking }) => {
    drop(
      conversationJobQueue.add({
        type: 'NullMessage',
        conversationId,
        idForTracking,
      })
    );
  });

  window.getSocketStatus = () => {
    return getSocketStatus();
  };

  accountManager.addEventListener('startRegistration', () => {
    pauseProcessing('startRegistration');
    // We should already be logged out, but this ensures that the next time we connect
    // to the auth socket it is from newly-registered credentials
    drop(logout());
    authSocketConnectCount = 0;

    backupReady.reject(new Error('startRegistration'));
    backupReady = explodePromise();
    registrationCompleted = explodePromise();
  });

  accountManager.addEventListener('endRegistration', () => {
    window.Whisper.events.emit('userChanged', false);

    drop(itemStorage.put('postRegistrationSyncsStatus', 'incomplete'));
    registrationCompleted?.resolve();
    drop(Registration.markDone());
  });

  const cancelInitializationMessage = setAppLoadingScreenMessage(
    undefined,
    i18n
  );

  const version = await DataReader.getItemById('version');
  if (!version) {
    const isIndexedDBPresent = await indexedDb.doesDatabaseExist();
    if (isIndexedDBPresent) {
      log.info('Found IndexedDB database.');
      try {
        log.info('Confirming deletion of old data with user...');

        try {
          await new Promise<void>((resolve, reject) => {
            showConfirmationDialog({
              dialogName: 'deleteOldIndexedDBData',
              noMouseClose: true,
              onTopOfEverything: true,
              cancelText: i18n('icu:quit'),
              confirmStyle: 'negative',
              title: i18n('icu:deleteOldIndexedDBData'),
              okText: i18n('icu:deleteOldData'),
              reject: () => reject(),
              resolve: () => resolve(),
            });
          });
        } catch (error) {
          log.info(
            'User chose not to delete old data. Shutting down.',
            Errors.toLogFormat(error)
          );
          window.IPC.shutdown();
          return;
        }

        log.info('Deleting all previously-migrated data in SQL...');
        log.info('Deleting IndexedDB file...');

        await Promise.all([
          indexedDb.removeDatabase(),
          DataWriter.removeAll(),
          DataWriter.removeIndexedDBFiles(),
        ]);
        log.info('Done with SQL deletion and IndexedDB file deletion.');
      } catch (error) {
        log.error(
          'Failed to remove IndexedDB file or remove SQL data:',
          Errors.toLogFormat(error)
        );
      }

      // Set a flag to delete IndexedDB on next startup if it wasn't deleted just now.
      // We need to use direct data calls, since storage isn't ready yet.
      await DataWriter.createOrUpdateItem({
        id: 'indexeddb-delete-needed',
        value: true,
      });
    }
  }

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  itemStorage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    restoreRemoteConfigFromStorage({
      storage: itemStorage,
    });

    window.Whisper.events.on('firstEnvelope', checkFirstEnvelope);

    const buildExpirationService = new BuildExpirationService();

    drop(
      connectWebAPI({
        ...itemStorage.user.getWebAPICredentials(),
        hasBuildExpired: buildExpirationService.hasBuildExpired(),
        hasStoriesDisabled: itemStorage.get('hasStoriesDisabled', false),
      })
    );

    buildExpirationService.on('expired', () => {
      drop(onExpiration('build'));
    });

    window.Whisper.events.on('challengeResponse', response => {
      challengeHandler.onResponse(response);
    });

    log.info('Initializing MessageReceiver');
    messageReceiver = new MessageReceiver({
      storage: itemStorage,
      serverTrustRoots: window.getServerTrustRoots(),
    });
    window.ConversationController.registerDelayBeforeUpdatingRedux(() => {
      if (backupsService.isImportRunning()) {
        return 500;
      }

      if (messageReceiver && !messageReceiver.hasEmptied()) {
        return 250;
      }

      return 1;
    });
    window.ConversationController.registerIsAppStillLoading(() => {
      return (
        backupsService.isImportRunning() ||
        !window.reduxStore?.getState().app.hasInitialLoadCompleted
      );
    });

    function queuedEventListener<E extends Event>(
      handler: (event: E) => Promise<void> | void
    ): (event: E) => void {
      return (event: E): void => {
        drop(
          eventHandlerQueue.add(
            createTaskWithTimeout(
              async () => handler(event),
              `queuedEventListener(${event.type}, ${event.timeStamp})`
            )
          )
        );
      };
    }

    messageReceiver.addEventListener(
      'envelopeUnsealed',
      queuedEventListener(onEnvelopeUnsealed)
    );
    messageReceiver.addEventListener(
      'envelopeQueued',
      queuedEventListener(onEnvelopeQueued)
    );
    messageReceiver.addEventListener(
      'message',
      queuedEventListener(onMessageReceived)
    );
    messageReceiver.addEventListener(
      'delivery',
      queuedEventListener(onDeliveryReceipt)
    );
    messageReceiver.addEventListener(
      'contactSync',
      queuedEventListener(onContactSync)
    );
    messageReceiver.addEventListener(
      'sent',
      queuedEventListener(onSentMessage)
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
    messageReceiver.addEventListener('error', queuedEventListener(onError));

    messageReceiver.addEventListener(
      'successful-decrypt',
      queuedEventListener(onSuccessfulDecrypt)
    );
    messageReceiver.addEventListener(
      'decryption-error',
      queuedEventListener(getOnDecryptionError(() => onDecryptionErrorQueue))
    );
    messageReceiver.addEventListener(
      'invalid-plaintext',
      queuedEventListener((event: InvalidPlaintextEvent): void => {
        drop(
          onDecryptionErrorQueue.add(() => onInvalidPlaintextMessage(event))
        );
      })
    );
    messageReceiver.addEventListener(
      'retry-request',
      queuedEventListener((event: RetryRequestEvent): void => {
        drop(onRetryRequestQueue.add(() => onRetryRequest(event)));
      })
    );
    messageReceiver.addEventListener(
      'empty',
      queuedEventListener(() => onEmpty({ isFromMessageReceiver: true }))
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
      'viewOnceOpenSync',
      queuedEventListener(onViewOnceOpenSync)
    );
    messageReceiver.addEventListener(
      'messageRequestResponse',
      queuedEventListener(onMessageRequestResponse)
    );
    messageReceiver.addEventListener(
      'profileKeyUpdate',
      queuedEventListener(onProfileKey)
    );
    messageReceiver.addEventListener(
      'fetchLatest',
      queuedEventListener(onFetchLatestSync)
    );
    messageReceiver.addEventListener('keys', queuedEventListener(onKeysSync));
    messageReceiver.addEventListener(
      'storyRecipientUpdate',
      queuedEventListener(onStoryRecipientUpdate)
    );
    messageReceiver.addEventListener(
      'callEventSync',
      queuedEventListener(onCallEventSync)
    );
    messageReceiver.addEventListener(
      'callLinkUpdateSync',
      queuedEventListener(onCallLinkUpdateSync)
    );
    messageReceiver.addEventListener(
      'callLogEventSync',
      queuedEventListener(onCallLogEventSync)
    );
    messageReceiver.addEventListener(
      'deleteForMeSync',
      queuedEventListener(onDeleteForMeSync)
    );
    messageReceiver.addEventListener(
      'attachmentBackfillResponseSync',
      queuedEventListener(onAttachmentBackfillResponseSync)
    );
    messageReceiver.addEventListener(
      'deviceNameChangeSync',
      queuedEventListener(onDeviceNameChangeSync)
    );

    if (!itemStorage.get('defaultConversationColor')) {
      drop(
        itemStorage.put('defaultConversationColor', DEFAULT_CONVERSATION_COLOR)
      );
    }

    senderCertificateService.initialize({
      server: {
        isOnline,
        getSenderCertificate,
      },
      events: window.Whisper.events,
      storage: itemStorage,
    });

    areWeASubscriberService.update(itemStorage, {
      isOnline,
      getHasSubscription,
    });

    void cleanupSessionResets();

    // These make key operations available to IPC handlers created in preload.js
    window.Events = createIPCEvents({
      shutdown: async () => {
        log.info('shutdown');

        flushMessageCounter();

        // Hangup active calls
        calling.hangupAllCalls({
          excludeRinging: true,
          reason: 'background/shutdown: shutdown requested',
        });

        const attachmentDownloadStopPromise = AttachmentDownloadManager.stop();
        const attachmentBackupStopPromise = AttachmentBackupManager.stop();

        cancelInflightRequests(JobCancelReason.Shutdown);

        // Stop background processing
        idleDetector.stop();

        // Stop processing incoming messages
        if (messageReceiver) {
          log.info('shutdown: shutting down messageReceiver');
          pauseProcessing('shutdown');
          await waitForAllBatchers();
        }

        log.info('shutdown: flushing conversations');

        // Flush debounced updates for conversations
        await Promise.all(
          window.ConversationController.getAll().map(convo =>
            convo.flushDebouncedUpdates()
          )
        );

        sleeper.shutdown();

        const shutdownQueues = async () => {
          log.info('shutdown: shutting down queues');
          await Promise.allSettled([
            StartupQueue.shutdown(),
            shutdownAllJobQueues(),
          ]);

          log.info('shutdown: shutting down conversation queues');
          await Promise.allSettled(
            window.ConversationController.getAll().map(async convo => {
              try {
                await convo.shutdownJobQueue();
              } catch (err) {
                log.error(
                  `shutdown: error waiting for conversation ${convo.idForLogging} job queue shutdown`,
                  Errors.toLogFormat(err)
                );
              }
            })
          );

          log.info('shutdown: all queues shutdown');
        };

        // wait for at most 1 minutes for startup queue and job queues to drain
        let timeout: NodeJS.Timeout | undefined;
        await Promise.race([
          shutdownQueues(),
          new Promise<void>((resolve, _) => {
            timeout = setTimeout(() => {
              log.warn(
                'shutdown - timed out waiting for StartupQueue/JobQueues, continuing with shutdown'
              );
              timeout = undefined;
              resolve();
            }, 10 * SECOND);
          }),
        ]);
        if (timeout) {
          clearTimeout(timeout);
        }

        log.info('shutdown: waiting for all batchers');

        // A number of still-to-queue database queries might be waiting inside batchers.
        //   We wait for these to empty first, and then shut down the data interface.
        await Promise.all([waitForAllBatchers(), waitForAllWaitBatchers()]);

        log.info(
          'shutdown: waiting for all attachment backups & downloads to finish'
        );
        // Since we canceled the inflight requests earlier in shutdown, these should
        // resolve quickly
        await attachmentDownloadStopPromise;
        await attachmentBackupStopPromise;

        log.info('shutdown: closing the database');

        // Shut down the data interface cleanly
        await DataWriter.shutdown();
      },
    });

    const zoomFactor = await window.Events.getZoomFactor();
    document.body.style.setProperty('--zoom-factor', zoomFactor.toString());

    window.Events.onZoomFactorChange(newZoomFactor => {
      document.body.style.setProperty(
        '--zoom-factor',
        newZoomFactor.toString()
      );
    });

    window.document.body.classList.add('window-focused');
    window.addEventListener('focus', () => {
      window.document.body.classList.add('window-focused');
    });
    window.addEventListener('blur', () =>
      window.document.body.classList.remove('window-focused')
    );

    const currentVersion = window.getVersion();
    lastVersion = itemStorage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await itemStorage.put('version', currentVersion);

    if (newVersion && lastVersion) {
      log.info(
        `New version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      const remoteBuildExpiration = itemStorage.get('remoteBuildExpiration');
      if (remoteBuildExpiration) {
        log.info(
          `Clearing remoteBuildExpiration. Previous value was ${remoteBuildExpiration}`
        );
        await itemStorage.remove('remoteBuildExpiration');
      }

      if (window.isBeforeVersion(lastVersion, '6.45.0-alpha')) {
        await removeStorageKeyJobQueue.add({
          key: 'previousAudioDeviceModule',
        });
      }

      if (window.isBeforeVersion(lastVersion, '6.25.0-alpha')) {
        await removeStorageKeyJobQueue.add({
          key: 'nextSignedKeyRotationTime',
        });
        await removeStorageKeyJobQueue.add({
          key: 'signedKeyRotationRejected',
        });
      }

      if (window.isBeforeVersion(lastVersion, 'v1.29.2-beta.1')) {
        // Stickers flags
        await Promise.all([
          itemStorage.put('showStickersIntroduction', true),
          itemStorage.put('showStickerPickerHint', true),
        ]);
      }

      if (window.isBeforeVersion(lastVersion, 'v1.32.0-beta.4')) {
        drop(DataWriter.ensureFilePermissions());
      }

      if (
        window.isBeforeVersion(lastVersion, 'v1.36.0-beta.1') &&
        window.isAfterVersion(lastVersion, 'v1.35.0-beta.1')
      ) {
        await StorageService.eraseAllStorageServiceState();
      }

      if (window.isBeforeVersion(lastVersion, 'v5.2.0')) {
        const legacySenderCertificateStorageKey = 'senderCertificateWithUuid';
        await removeStorageKeyJobQueue.add({
          key: legacySenderCertificateStorageKey,
        });
      }

      if (window.isBeforeVersion(lastVersion, 'v5.18.0')) {
        await itemStorage.remove('senderCertificate');
        await itemStorage.remove('senderCertificateNoE164');
      }

      if (window.isBeforeVersion(lastVersion, 'v5.19.0')) {
        await itemStorage.remove(GROUP_CREDENTIALS_KEY);
      }

      if (window.isBeforeVersion(lastVersion, 'v5.37.0-alpha')) {
        const legacyChallengeKey = 'challenge:retry-message-ids';
        await removeStorageKeyJobQueue.add({
          key: legacyChallengeKey,
        });

        await DataWriter.clearAllErrorStickerPackAttempts();
      }

      if (window.isBeforeVersion(lastVersion, 'v5.51.0-beta.2')) {
        await itemStorage.put('groupCredentials', []);
        await DataWriter.removeAllProfileKeyCredentials();
      }

      if (window.isBeforeVersion(lastVersion, 'v6.38.0-beta.1')) {
        await itemStorage.remove('hasCompletedSafetyNumberOnboarding');
      }

      // This one should always be last - it could restart the app
      if (window.isBeforeVersion(lastVersion, 'v5.30.0-alpha')) {
        await deleteAllLogs();
        window.SignalContext.restartApp();
        return;
      }

      if (window.isBeforeVersion(lastVersion, 'v7.3.0-beta.1')) {
        await itemStorage.remove('lastHeartbeat');
        await itemStorage.remove('lastStartup');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.8.0-beta.1')) {
        await itemStorage.remove('sendEditWarningShown');
        await itemStorage.remove('formattingWarningShown');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.21.0-beta.1')) {
        await itemStorage.remove(
          'hasRegisterSupportForUnauthenticatedDelivery'
        );
      }

      if (window.isBeforeVersion(lastVersion, 'v7.33.0-beta.1')) {
        await itemStorage.remove('masterKeyLastRequestTime');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.43.0-beta.1')) {
        await itemStorage.remove('primarySendsSms');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.56.0-beta.1')) {
        await itemStorage.remove('backupMediaDownloadIdle');
      }

      if (
        window.isBeforeVersion(lastVersion, 'v7.57.0') &&
        itemStorage.get('needProfileMovedModal') === undefined
      ) {
        await itemStorage.put('needProfileMovedModal', true);
      }

      if (window.isBeforeVersion(lastVersion, 'v7.75.0-beta.1')) {
        const hasAllChatsChatFolder = await DataReader.hasAllChatsChatFolder();
        if (!hasAllChatsChatFolder) {
          log.info('Creating "all chats" chat folder');
          await DataWriter.createAllChatsChatFolder();
          StorageService.storageServiceUploadJobAfterEnabled({
            reason: 'createAllChatsChatFolder',
          });
        }
      }
    }

    setAppLoadingScreenMessage(i18n('icu:optimizingApplication'), i18n);

    if (newVersion || itemStorage.get('needOrphanedAttachmentCheck')) {
      await itemStorage.remove('needOrphanedAttachmentCheck');
      await DataWriter.cleanupOrphanedAttachments();
    }

    if (
      newVersion &&
      lastVersion &&
      window.isBeforeVersion(lastVersion, 'v7.18.0-beta.1')
    ) {
      await encryptConversationAttachments();
      await Stickers.encryptLegacyStickers();
    }

    setAppLoadingScreenMessage(i18n('icu:loading'), i18n);

    let isMigrationWithIndexComplete = false;
    let isIdleTaskProcessing = false;
    log.info(
      `Starting background data migration. Target version: ${CURRENT_SCHEMA_VERSION}`
    );
    idleDetector.on('idle', async () => {
      const NUM_MESSAGES_PER_BATCH = 250;
      const BATCH_DELAY = durations.SECOND / 4;

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
          const batchWithIndex = await migrateBatchOfMessages({
            numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
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

    retryPlaceholders.start(itemStorage);

    setInterval(async () => {
      const now = Date.now();
      let sentProtoMaxAge = 14 * DAY;

      try {
        sentProtoMaxAge = parseIntOrThrow(
          getRemoteConfigValue('desktop.retryRespondMaxAge'),
          'retryRespondMaxAge'
        );
      } catch (error) {
        log.warn(
          'setInterval: Failed to parse integer from desktop.retryRespondMaxAge feature flag',
          Errors.toLogFormat(error)
        );
      }

      try {
        await DataWriter.deleteSentProtosOlderThan(now - sentProtoMaxAge);
      } catch (error) {
        log.error(
          'onready/setInterval: Error deleting sent protos: ',
          Errors.toLogFormat(error)
        );
      }

      try {
        const expired = await retryPlaceholders.getExpiredAndRemove();
        log.info(
          `retryPlaceholders/interval: Found ${expired.length} expired items`
        );
        expired.forEach(item => {
          const { conversationId, senderAci, sentAt } = item;
          const conversation =
            window.ConversationController.get(conversationId);
          if (conversation) {
            const receivedAt = Date.now();
            const receivedAtCounter = incrementMessageCounter();
            drop(
              conversation.queueJob('addDeliveryIssue', () =>
                conversation.addDeliveryIssue({
                  receivedAt,
                  receivedAtCounter,
                  senderAci,
                  sentAt,
                })
              )
            );
          }
        });
      } catch (error) {
        log.error(
          'onready/setInterval: Error getting expired retry placeholders: ',
          Errors.toLogFormat(error)
        );
      }
    }, FIVE_MINUTES);

    setInterval(() => {
      reportLongRunningTasks();
    }, FIVE_MINUTES);

    setInterval(() => {
      drop(window.Events.cleanupDownloads());
    }, DAY);

    try {
      // This needs to load before we prime the data because we expect
      // ConversationController to be loaded and ready to use by then.
      await window.ConversationController.load();

      await Promise.all([
        window.ConversationController.getOrCreateSignalConversation(),
        signalProtocolStore.hydrateCaches(),
        loadAll(),
      ]);
      await window.ConversationController.checkForConflicts();
    } catch (error) {
      log.error(
        'js: ConversationController failed to load:',
        Errors.toLogFormat(error)
      );
    } finally {
      setupAppState();
      drop(start());
      initializeNetworkObserver(
        window.reduxActions.network,
        () => window.getSocketStatus().authenticated.status
      );
      initializeUpdateListener(window.reduxActions.updates);
      calling.initialize(
        {
          ...window.reduxActions.calling,
          areAnyCallsActiveOrRinging: () =>
            areAnyCallsActiveOrRinging(window.reduxStore.getState()),
        },
        window.getSfuUrl()
      );
      window.reduxActions.expiration.hydrateExpirationStatus(
        window.getBuildExpiration()
      );

      // Process crash reports if any. Note that the modal won't be visible
      // until the app will finish loading.
      window.reduxActions.crashReports.setCrashReportCount(
        await window.IPC.crashReports.getCount()
      );
    }
  });
  // end of storage.onready() callback

  log.info('Storage fetch');
  drop(itemStorage.fetch());

  function pauseProcessing(reason: string) {
    strictAssert(
      messageReceiver != null,
      'messageReceiver must be initialized'
    );

    StorageService.disableStorageService(reason);
    unregisterRequestHandler(messageReceiver);
    messageReceiver.stopProcessing();
  }

  function setupAppState() {
    initializeRedux(getParametersForRedux());

    window.Whisper.events.on('userChanged', (reconnect = false) => {
      const newDeviceId = itemStorage.user.getDeviceId();
      const newNumber = itemStorage.user.getNumber();
      const newACI = itemStorage.user.getAci();
      const newPNI = itemStorage.user.getPni();
      const ourConversation =
        window.ConversationController.getOurConversation();

      if (ourConversation?.get('e164') !== newNumber) {
        ourConversation?.set({ e164: newNumber });
      }

      window.reduxActions.user.userChanged({
        ourConversationId: ourConversation?.get('id'),
        ourDeviceId: newDeviceId,
        ourNumber: newNumber,
        ourAci: newACI,
        ourPni: newPNI,
        regionCode: itemStorage.get('regionCode'),
      });

      if (reconnect) {
        log.info('reconnecting websocket on user change');
        enqueueReconnectToWebSocket();
      }
    });

    window.Whisper.events.on('setMenuOptions', (options: MenuOptionsType) => {
      window.reduxActions.user.userChanged({ menuOptions: options });
    });

    addGlobalKeyboardShortcuts();
  }

  window.Whisper.events.on('setupAsNewDevice', () => {
    window.IPC.readyForUpdates();
    window.reduxActions.installer.startInstaller();
  });

  window.Whisper.events.on('setupAsStandalone', () => {
    window.reduxActions.app.openStandalone();
  });

  window.Whisper.events.on('openSettingsTab', async () => {
    window.reduxActions.nav.changeLocation({
      tab: NavTab.Settings,
      details: {
        page: SettingsPage.Profile,
        state: ProfileEditorPage.None,
      },
    });
  });

  window.Whisper.events.on('stageLocalBackupForImport', () => {
    drop(backupsService._internalStageLocalBackupForImport());
  });

  window.Whisper.events.on('powerMonitorSuspend', () => {
    log.info('powerMonitor: suspend');
    cancelInflightRequests(JobCancelReason.PowerMonitorSuspend);
    suspendTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorResume', () => {
    log.info('powerMonitor: resume');
    checkSockets();
    cancelInflightRequests(JobCancelReason.PowerMonitorResume);
    resumeTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorLockScreen', () => {
    window.reduxActions.calling.hangUpActiveCall('powerMonitorLockScreen');
  });

  const reconnectToWebSocketQueue = new LatestQueue();

  const enqueueReconnectToWebSocket = () => {
    reconnectToWebSocketQueue.add(async () => {
      if (remotelyExpired) {
        return;
      }

      log.info('reconnectToWebSocket starting...');
      await reconnectWebAPI();
    });
  };

  const throttledEnqueueReconnectToWebSocket = throttle(
    enqueueReconnectToWebSocket,
    1000
  );

  window.Whisper.events.on('mightBeUnlinked', () => {
    if (Registration.everDone()) {
      throttledEnqueueReconnectToWebSocket();
    }
  });

  window.Whisper.events.on('unlinkAndDisconnect', () => {
    drop(unlinkAndDisconnect());
  });

  window.Whisper.events.on('httpResponse499', () => {
    if (remotelyExpired) {
      return;
    }

    log.error('remote expiration detected, disabling reconnects');
    drop(itemStorage.put('remoteBuildExpiration', Date.now()));
    drop(onExpiration('remote'));
    remotelyExpired = true;
  });

  async function enableStorageService({ andSync }: { andSync?: string } = {}) {
    log.info('enableStorageService: waiting for backupReady');
    try {
      await backupReady.promise;
    } catch (error) {
      log.warn('enableStorageService: backup is not ready; returning early');
      return;
    }

    log.info('enableStorageService: enabling and running');
    StorageService.enableStorageService();

    if (andSync != null) {
      await StorageService.runStorageServiceSyncJob({
        reason: andSync,
      });
      StorageService.runStorageServiceSyncJob.flush();
    }
  }

  async function start() {
    // Storage is ready because `start()` is called from `storage.onready()`

    initializeAllJobQueues({
      server: {
        isOnline,
        reportMessage,
      },
    });

    strictAssert(challengeHandler, 'start: challengeHandler');
    await challengeHandler.load();

    if (!itemStorage.user.getNumber()) {
      const ourConversation =
        window.ConversationController.getOurConversation();
      const ourE164 = ourConversation?.get('e164');
      if (ourE164) {
        log.warn('Restoring E164 from our conversation');
        await itemStorage.user.setNumber(ourE164);
      }
    }

    if (newVersion && lastVersion) {
      if (window.isBeforeVersion(lastVersion, 'v5.31.0')) {
        window.ConversationController.repairPinnedConversations();
      }

      if (!itemStorage.get('avatarsHaveBeenMigrated', false)) {
        window.ConversationController.migrateAvatarsForNonAcceptedConversations();
      }
    }

    void badgeImageFileDownloader.checkForFilesToDownload();

    initializeExpiringMessageService();
    initializeNotificationProfilesService();

    log.info('Blocked uuids cleanup: starting...');
    const blockedUuids = itemStorage.get(BLOCKED_UUIDS_ID, []);
    const blockedAcis = blockedUuids.filter(isAciString);
    const diff = blockedUuids.length - blockedAcis.length;
    if (diff > 0) {
      log.warn(
        `Blocked uuids cleanup: Found ${diff} non-ACIs in blocked list. Removing.`
      );
      await itemStorage.put(BLOCKED_UUIDS_ID, blockedAcis);
    }
    log.info('Blocked uuids cleanup: complete');

    log.info('Expiration start timestamp cleanup: starting...');
    const messagesUnexpectedlyMissingExpirationStartTimestamp =
      await DataReader.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
    log.info(
      `Expiration start timestamp cleanup: Found ${messagesUnexpectedlyMissingExpirationStartTimestamp.length} messages for cleanup`
    );
    if (!itemStorage.user.getAci()) {
      log.info(
        "Expiration start timestamp cleanup: Canceling update; we don't have our own UUID"
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

      await DataWriter.saveMessages(newMessageAttributes, {
        ourAci: itemStorage.user.getCheckedAci(),
        postSaveUpdates,
      });
    }
    log.info('Expiration start timestamp cleanup: complete');

    await runAllSyncTasks();

    cancelInitializationMessage();

    const appContainer = document.getElementById('app-container');
    strictAssert(appContainer != null, 'No #app-container');
    createRoot(appContainer).render(createAppRoot(window.reduxStore));
    const hideMenuBar = itemStorage.get('hide-menu-bar', false);
    window.IPC.setAutoHideMenuBar(hideMenuBar);
    window.IPC.setMenuBarVisibility(!hideMenuBar);

    startTimeTravelDetector(() => {
      window.Whisper.events.emit('timetravel');
    });

    updateExpiringMessagesService();
    updateNotificationProfileService();
    tapToViewMessagesDeletionService.update();
    window.Whisper.events.on('timetravel', () => {
      updateExpiringMessagesService();
      updateNotificationProfileService();
      tapToViewMessagesDeletionService.update();
    });

    const isCoreDataValid = Boolean(
      itemStorage.user.getAci() &&
        window.ConversationController.getOurConversation()
    );

    if (isCoreDataValid && Registration.everDone()) {
      idleDetector.start();
      if (itemStorage.get('backupDownloadPath')) {
        window.reduxActions.installer.showBackupImport();
      } else {
        window.reduxActions.app.openInbox();
      }
    } else {
      window.IPC.readyForUpdates();
      drop(
        (async () => {
          try {
            await window.IPC.whenWindowVisible();
          } finally {
            window.reduxActions.installer.startInstaller();
          }
        })()
      );
    }

    const { activeWindowService } = window.SignalContext;

    activeWindowService.registerForActive(() => notificationService.clear());
    window.addEventListener('unload', () => notificationService.fastClear());

    // Maybe refresh remote configuration when we become active
    activeWindowService.registerForActive(async () => {
      try {
        await maybeRefreshRemoteConfig({
          getConfig,
          storage: itemStorage,
        });
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
    onRemoteConfigChange('desktop.clientExpiration', ({ enabled, value }) => {
      if (!enabled) {
        return;
      }
      const remoteBuildExpirationTimestamp = parseRemoteClientExpiration(value);
      if (remoteBuildExpirationTimestamp) {
        drop(
          itemStorage.put(
            'remoteBuildExpiration',
            remoteBuildExpirationTimestamp
          )
        );
      }
    });

    if (resolveOnAppView) {
      resolveOnAppView();
      resolveOnAppView = undefined;
    }

    setupNetworkChangeListeners();
  }

  function setupNetworkChangeListeners() {
    const onOnline = () => {
      log.info('online');
      drop(afterAuthSocketConnect());
    };

    window.Whisper.events.on('online', onOnline);

    const onOffline = () => {
      const { hasInitialLoadCompleted, appView } =
        window.reduxStore.getState().app;

      const hasAppEverBeenRegistered = Registration.everDone();

      log.info('offline', {
        authSocketConnectCount,
        hasInitialLoadCompleted,
        appView,
        hasAppEverBeenRegistered,
      });

      drop(challengeHandler.onOffline());
      drop(AttachmentDownloadManager.stop());
      drop(AttachmentBackupManager.stop());

      if (messageReceiver) {
        drop(messageReceiver.drain());
        unregisterRequestHandler(messageReceiver);
      }

      if (hasAppEverBeenRegistered) {
        const state = window.reduxStore.getState();
        if (state.app.appView === AppViewType.Installer) {
          if (state.installer.step === InstallScreenStep.LinkInProgress) {
            log.info(
              'offline, but app has been registered before; opening inbox'
            );
            window.reduxActions.app.openInbox();
          } else if (state.installer.step === InstallScreenStep.BackupImport) {
            log.warn('offline, but app has needs to import backup');
            // TODO: DESKTOP-7584
          }
        }

        if (!hasInitialLoadCompleted) {
          log.info('offline; initial load not completed; triggering onEmpty');
          drop(onEmpty({ isFromMessageReceiver: false })); // this ensures that the inbox loading progress bar is dismissed
        }
      }
    };
    window.Whisper.events.on('offline', onOffline);

    // Because these events may have already fired, we manually call their handlers.
    // isOnline() will return undefined if neither of these events have been emitted.
    if (isOnline() === true) {
      onOnline();
    } else if (isOnline() === false) {
      onOffline();
    }
  }

  let backupReady = explodePromise<{ wasBackupImported: boolean }>();
  let registrationCompleted: ExplodePromiseResultType<void> | undefined;
  let authSocketConnectCount = 0;
  let afterAuthSocketConnectPromise: ExplodePromiseResultType<void> | undefined;
  let remotelyExpired = false;

  async function afterAuthSocketConnect() {
    let contactSyncComplete: Promise<void> | undefined;
    let storageServiceSyncComplete: Promise<void> | undefined;
    let hasSentSyncRequests = false;

    const isFirstAuthSocketConnect = authSocketConnectCount === 0;
    const logId = `afterAuthSocketConnect.${authSocketConnectCount}`;

    authSocketConnectCount += 1;

    if (remotelyExpired) {
      log.info('afterAuthSocketConnect: remotely expired');
      drop(onEmpty({ isFromMessageReceiver: false })); // this ensures that the inbox loading progress bar is dismissed
      return;
    }

    strictAssert(messageReceiver, 'messageReceiver must be initialized');

    while (afterAuthSocketConnectPromise?.promise) {
      log.info(`${logId}: waiting for previous run to finish`);
      // eslint-disable-next-line no-await-in-loop
      await afterAuthSocketConnectPromise.promise;
    }

    afterAuthSocketConnectPromise = explodePromise();
    log.info(`${logId}: starting`);

    try {
      // 1. Await any ongoing registration
      if (registrationCompleted) {
        log.info(`${logId}: awaiting completion of registration`);
        await registrationCompleted?.promise;
      }

      if (!itemStorage.user.getAci()) {
        log.error(`${logId}: ACI not captured during registration, unlinking`);
        return unlinkAndDisconnect();
      }

      if (!itemStorage.user.getPni()) {
        log.error(`${logId}: PNI not captured during registration, unlinking`);
        return unlinkAndDisconnect();
      }

      // 2. Fetch remote config, before we process the message queue
      if (isFirstAuthSocketConnect) {
        try {
          await forceRefreshRemoteConfig(
            { getConfig, storage: itemStorage },
            'afterAuthSocketConnect/firstConnect'
          );
        } catch (error) {
          log.error(
            `${logId}: Error refreshing remote config:`,
            isNumber(error.code)
              ? `code: ${error.code}`
              : Errors.toLogFormat(error)
          );
        }
      }

      const postRegistrationSyncsComplete =
        itemStorage.get('postRegistrationSyncsStatus') !== 'incomplete';

      // 3. Send any critical sync requests after registration
      if (!postRegistrationSyncsComplete) {
        log.info(`${logId}: postRegistrationSyncs not complete, sending sync`);

        setIsInitialContactSync(true);
        contactSyncComplete = waitForEvent('contactSync:complete');
        drop(sendSyncRequests());
        hasSentSyncRequests = true;
      }

      // 4. Download (or resume download) of link & sync backup or local backup
      const { wasBackupImported } = await maybeDownloadAndImportBackup();
      log.info(logId, {
        wasBackupImported,
      });

      // 5. Start processing messages from websocket and clear
      // `messageReceiver.#isEmptied`.
      log.info(`${logId}: enabling message processing`);
      messageReceiver.startProcessingQueue();
      registerRequestHandler(messageReceiver);

      // 6. Kickoff storage service sync
      if (isFirstAuthSocketConnect || !postRegistrationSyncsComplete) {
        log.info(`${logId}: triggering storage service sync`);

        storageServiceSyncComplete = waitForEvent(
          'storageService:syncComplete'
        );
        drop(
          enableStorageService({
            andSync: 'afterFirstAuthSocketConnect',
          })
        );
      } else {
        drop(enableStorageService());
      }

      // 7. Wait for critical post-registration syncs before showing inbox
      if (!postRegistrationSyncsComplete) {
        const syncsToAwaitBeforeShowingInbox = [contactSyncComplete];

        // If backup was imported, we do not need to await the storage service sync
        if (!wasBackupImported) {
          syncsToAwaitBeforeShowingInbox.push(storageServiceSyncComplete);
        }

        try {
          log.info(`${logId}: waiting for postRegistrationSyncs`);
          await Promise.all(syncsToAwaitBeforeShowingInbox);
          await itemStorage.put('postRegistrationSyncsStatus', 'complete');
          log.info(`${logId}: postRegistrationSyncs complete`);
        } catch (error) {
          log.error(
            `${logId}: Failed to run postRegistrationSyncs`,
            Errors.toLogFormat(error)
          );
        }
      }

      // 8. Show inbox
      const state = window.reduxStore.getState();
      if (state.app.appView === AppViewType.Installer) {
        log.info(`${logId}: switching from installer to inbox`);
        window.reduxActions.app.openInbox();
      }

      // 9. Start services requiring auth connection
      afterEveryAuthConnect();

      // 10. Handle once-on-boot tasks
      if (isFirstAuthSocketConnect) {
        afterEveryLinkedStartup();
      }

      // 10. Handle infrequent once-on-new-version tasks
      if (newVersion) {
        drop(
          afterEveryLinkedStartupOnNewVersion({
            skipSyncRequests: hasSentSyncRequests,
          })
        );
      }
    } catch (e) {
      log.error(`${logId}: error`, Errors.toLogFormat(e));
    } finally {
      afterAuthSocketConnectPromise?.resolve();
      afterAuthSocketConnectPromise = undefined;
    }
  }

  async function maybeDownloadAndImportBackup(): Promise<{
    wasBackupImported: boolean;
  }> {
    const backupDownloadPath = itemStorage.get('backupDownloadPath');
    const isLocalBackupAvailable =
      backupsService.isLocalBackupStaged() && isLocalBackupsEnabled();

    if (isLocalBackupAvailable || backupDownloadPath) {
      tapToViewMessagesDeletionService.pause();

      // Download backup before enabling request handler and storage service
      try {
        let wasBackupImported = false;
        if (isLocalBackupAvailable) {
          await backupsService.importLocalBackup();
          wasBackupImported = true;
        } else {
          ({ wasBackupImported } = await backupsService.downloadAndImport({
            onProgress: (backupStep, currentBytes, totalBytes) => {
              window.reduxActions.installer.updateBackupImportProgress({
                backupStep,
                currentBytes,
                totalBytes,
              });
            },
          }));
        }

        log.info('afterAppStart: backup download attempt completed, resolving');
        backupReady.resolve({ wasBackupImported });
      } catch (error) {
        log.error('afterAppStart: backup download failed, rejecting');
        backupReady.reject(error);
        throw error;
      } finally {
        tapToViewMessagesDeletionService.resume();
      }
    } else {
      backupReady.resolve({ wasBackupImported: false });
    }

    return backupReady.promise;
  }

  function afterEveryLinkedStartup() {
    log.info('afterAuthSocketConnect/afterEveryLinkedStartup');

    // Note: we always have to register our capabilities all at once, so we do this
    //   after connect on every startup
    drop(registerCapabilities());
    drop(ensureAEP());
    drop(maybeQueueDeviceNameFetch());
    Stickers.downloadQueuedPacks();
  }

  async function afterEveryLinkedStartupOnNewVersion({
    skipSyncRequests = false,
  }: {
    skipSyncRequests: boolean;
  }) {
    log.info('afterAuthSocketConnect/afterEveryLinkedStartupOnNewVersion');

    if (window.ConversationController.areWePrimaryDevice()) {
      return;
    }

    try {
      if (!skipSyncRequests) {
        drop(sendSyncRequests());
      }

      drop(StorageService.reprocessUnknownFields());

      await Promise.all([
        accountManager.maybeUpdateDeviceName(),
        itemStorage.user.removeSignalingKey(),
      ]);
    } catch (e) {
      log.error(
        "Problem with 'afterLinkedStartupOnNewVersion' tasks: ",
        Errors.toLogFormat(e)
      );
    }
  }

  async function ensureAEP() {
    if (
      itemStorage.get('accountEntropyPool') ||
      window.ConversationController.areWePrimaryDevice()
    ) {
      return;
    }

    const lastSent = itemStorage.get('accountEntropyPoolLastRequestTime') ?? 0;
    const now = Date.now();

    // If we last attempted sync one day in the past, or if we time
    // traveled.
    if (isOlderThan(lastSent, DAY) || lastSent > now) {
      log.warn('ensureAEP: AEP not captured, requesting sync');
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
      await itemStorage.put('accountEntropyPoolLastRequestTime', now);
    } else {
      log.warn(
        'ensureAEP: AEP not captured, but sync requested recently.' +
          'Not running'
      );
    }
  }

  async function registerCapabilities() {
    try {
      await doRegisterCapabilities({
        attachmentBackfill: true,
        spqr: true,
      });
    } catch (error) {
      log.error(
        'Error: Unable to register our capabilities.',
        Errors.toLogFormat(error)
      );
    }
  }

  function afterEveryAuthConnect() {
    log.info('afterAuthSocketConnect/afterEveryAuthConnect');

    drop(handleServerAlerts(getServerAlerts()));

    drop(challengeHandler.onOnline());

    reconnectBackOff.reset();
    drop(initializeGroupCredentialFetcher());
    drop(AttachmentDownloadManager.start());

    if (areRemoteBackupsTurnedOn()) {
      backupsService.start();
      drop(AttachmentBackupManager.start());
    }
  }

  window.addEventListener('online', onNavigatorOnline);
  window.addEventListener('offline', onNavigatorOffline);

  window.Whisper.events.on('socketStatusChange', () => {
    if (window.getSocketStatus().authenticated.status === SocketStatus.OPEN) {
      pauseQueuesAndNotificationsOnSocketConnect();
    }
  });

  // 1. When the socket is connected, to avoid a flood of operations before we catch up,
  //    we pause some queues.
  function pauseQueuesAndNotificationsOnSocketConnect() {
    log.info('pauseQueuesAndNotificationsOnSocketConnect: pausing');
    profileKeyResponseQueue.pause();
    lightSessionResetQueue.pause();
    onDecryptionErrorQueue.pause();
    onRetryRequestQueue.pause();
    deliveryReceiptQueue.pause();
    notificationService.disable();
  }

  // 2. After the socket finishes processing any queued messages, restart these queues
  function restartQueuesAndNotificationsOnEmpty() {
    log.info('restartQueuesAndNotificationsOnEmpty: restarting');
    profileKeyResponseQueue.start();
    lightSessionResetQueue.start();
    onDecryptionErrorQueue.start();
    onRetryRequestQueue.start();
    deliveryReceiptQueue.start();
    notificationService.enable();
  }

  function isSocketOnline() {
    const socketStatus = window.getSocketStatus().authenticated.status;
    return (
      socketStatus === SocketStatus.CONNECTING ||
      socketStatus === SocketStatus.OPEN
    );
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

    const waitStart = Date.now();

    if (!messageReceiver.hasEmptied()) {
      log.info(
        'waitForEmptyEventQueue: Waiting for MessageReceiver empty event...'
      );
      const { resolve, reject, promise } = explodePromise<void>();

      const cleanup = () => {
        messageReceiver?.removeEventListener('empty', onEmptyOnce);
        messageReceiver?.removeEventListener('envelopeQueued', onResetTimer);

        if (timeout !== undefined) {
          Timers.clearTimeout(timeout);
          timeout = undefined;
        }
      };

      // Reject after 1 minutes of inactivity.
      const onTimeout = () => {
        cleanup();
        reject(new Error('Empty queue never fired'));
      };
      let timeout: Timers.Timeout | undefined = Timers.setTimeout(
        onTimeout,
        durations.MINUTE
      );

      const onEmptyOnce = () => {
        cleanup();
        resolve();
      };
      messageReceiver.addEventListener('empty', onEmptyOnce);

      const onResetTimer = () => {
        if (timeout !== undefined) {
          Timers.clearTimeout(timeout);
        }
        timeout = Timers.setTimeout(onTimeout, durations.MINUTE);
      };
      messageReceiver.addEventListener('envelopeQueued', onResetTimer);

      await promise;
    }

    if (eventHandlerQueue.pending !== 0 || eventHandlerQueue.size !== 0) {
      log.info(
        'waitForEmptyEventQueue: Waiting for event handler queue idle...'
      );
      await eventHandlerQueue.onIdle();
    }

    const duration = Date.now() - waitStart;
    if (duration > SECOND) {
      log.info(`waitForEmptyEventQueue: resolving after ${duration}ms`);
    }
  }

  window.waitForEmptyEventQueue = waitForEmptyEventQueue;

  async function onEmpty({
    isFromMessageReceiver,
  }: { isFromMessageReceiver?: boolean } = {}): Promise<void> {
    await Promise.all([waitForAllBatchers(), flushAllWaitBatchers()]);
    log.info('onEmpty: All outstanding database requests complete');
    window.IPC.readyForUpdates();
    window.ConversationController.onEmpty();

    // Start listeners here, after we get through our queue.
    UpdateKeysListener.init(window.Whisper.events, newVersion);

    restartQueuesAndNotificationsOnEmpty();

    await onAppView;

    window.reduxActions.app.initialLoadComplete();

    const processedCount = messageReceiver?.getAndResetProcessedCount() || 0;
    window.IPC.logAppLoadedEvent?.({
      processedCount,
    });
    if (messageReceiver) {
      log.info('App loaded - messages:', processedCount);
    }

    setBatchingStrategy(false);
    StartupQueue.flush();
    await flushAttachmentDownloadQueue();

    // Kick off a profile refresh if necessary, but don't wait for it, as failure is
    //   tolerable.
    if (!routineProfileRefresher) {
      routineProfileRefresher = new RoutineProfileRefresher({
        getAllConversations: () => window.ConversationController.getAll(),
        getOurConversationId: () =>
          window.ConversationController.getOurConversationId(),
        storage: itemStorage,
      });

      void routineProfileRefresher.start();
    }

    drop(usernameIntegrity.start());

    drop(
      ReleaseNotesFetcher.init(
        {
          isOnline,
          getReleaseNote,
          getReleaseNoteHash,
          getReleaseNoteImageAttachment,
          getReleaseNotesManifest,
          getReleaseNotesManifestHash,
        },
        window.Whisper.events,
        newVersion
      )
    );

    drop(initializeDonationService());

    if (isFromMessageReceiver) {
      drop(
        (async () => {
          let lastRowId: number | null = 0;
          while (lastRowId != null) {
            const result =
              // eslint-disable-next-line no-await-in-loop
              await DataWriter.dequeueOldestSyncTasks({
                previousRowId: lastRowId,
                incrementAttempts: false,
                syncTaskTypes: [
                  'delete-conversation',
                  'delete-local-conversation',
                ],
              });
            const syncTasks = result.tasks;
            if (syncTasks.length > 0) {
              log.info(
                `onEmpty/syncTasks: Queueing ${syncTasks.length} sync tasks for reattempt`
              );
              // eslint-disable-next-line no-await-in-loop
              await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);
              // eslint-disable-next-line no-await-in-loop
              await Promise.resolve(); // one tick
            }

            lastRowId = result.lastRowId;
          }
          log.info('onEmpty/syncTasks: Incrementing all sync task attempts');
          drop(DataWriter.incrementAllSyncTaskAttempts());
        })()
      );
    }
  }

  window.Whisper.events.on('manualConnect', manualConnect);
  function manualConnect() {
    if (isSocketOnline()) {
      log.info('manualConnect: already online; not connecting again');
      return;
    }

    log.info('manualConnect: calling connect()');
    enqueueReconnectToWebSocket();
  }

  async function onConfiguration(ev: ConfigurationEvent): Promise<void> {
    ev.confirm();

    const { configuration } = ev;
    const {
      readReceipts,
      typingIndicators,
      unidentifiedDeliveryIndicators,
      linkPreviews,
    } = configuration;

    await itemStorage.put('read-receipt-setting', Boolean(readReceipts));

    if (
      unidentifiedDeliveryIndicators === true ||
      unidentifiedDeliveryIndicators === false
    ) {
      await itemStorage.put(
        'unidentifiedDeliveryIndicators',
        unidentifiedDeliveryIndicators
      );
    }

    if (typingIndicators === true || typingIndicators === false) {
      await itemStorage.put('typingIndicators', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      await itemStorage.put('linkPreviews', linkPreviews);
    }
  }

  function onTyping(ev: TypingEvent): void {
    // Note: this type of message is automatically removed from cache in MessageReceiver

    const { typing, sender, senderAci, senderDevice } = ev;
    const { groupV2Id, started } = typing || {};

    // We don't do anything with incoming typing messages if the setting is disabled
    if (!itemStorage.get('typingIndicators')) {
      return;
    }

    let conversation;

    const { conversation: senderConversation } =
      window.ConversationController.maybeMergeContacts({
        e164: sender,
        aci: senderAci,
        reason: `onTyping(${typing.timestamp})`,
      });

    // We multiplex between GV1/GV2 groups here, but we don't kick off migrations
    if (groupV2Id) {
      conversation = window.ConversationController.get(groupV2Id);
    } else {
      conversation = senderConversation;
    }

    const ourId = window.ConversationController.getOurConversationId();

    if (!ourId) {
      log.warn("onTyping: Couldn't get our own id!");
      return;
    }
    if (!conversation) {
      log.warn(
        `onTyping: Did not find conversation for typing indicator (groupv2(${groupV2Id}), ${sender}, ${senderAci})`
      );
      return;
    }

    if (isGroup(conversation.attributes)) {
      // We drop typing notifications in groups we're not a part of
      if (!conversation.areWeAMember()) {
        log.warn(
          `Received typing indicator for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
        );
        return;
      }

      // We also drop typing notifications from users not part of the group
      const serviceId = senderConversation.getServiceId();
      if (!serviceId || !conversation.hasMember(serviceId)) {
        log.warn(
          `Received typing indicator for group ${conversation.idForLogging()} from a non-group member. Dropping.`
        );
        return;
      }
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

  function onStickerPack(ev: StickerPackEvent): void {
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
          actionSource: 'syncMessage',
        });
      } else if (isInstall) {
        if (status === 'downloaded') {
          window.reduxActions.stickers.installStickerPack(id, key, {
            actionSource: 'syncMessage',
          });
        } else {
          void Stickers.downloadStickerPack(id, key, {
            finalStatus: 'installed',
            actionSource: 'syncMessage',
          });
        }
      }
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
      await sender.setProfileKey(profileKey, {
        reason: 'handleMessageReceivedProfileUpdate',
      });
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
          log.error(
            'respondWithProfileKeyBatcher error',
            Errors.toLogFormat(error)
          );
        }

        drop(
          sender.queueJob('sendProfileKeyUpdate', () =>
            sender.sendProfileKeyUpdate()
          )
        );
      });
    },

    wait: 200,
    maxSize: Infinity,
  });

  const _throttledSetInboxEnvelopeTimestamp = throttle(
    serverTimestamp => {
      window.reduxActions.inbox.setInboxEnvelopeTimestamp(serverTimestamp);
    },
    100,
    { leading: false }
  );

  function setInboxEnvelopeTimestamp(timestamp: number): void {
    // This timestamp is only used in the loading screen UI. If the app has loaded, let's
    // not set it to avoid unnecessary renders
    if (!window.reduxStore.getState().app.hasInitialLoadCompleted) {
      _throttledSetInboxEnvelopeTimestamp(timestamp);
    }
  }

  async function onEnvelopeQueued({
    envelope,
  }: EnvelopeQueuedEvent): Promise<void> {
    setInboxEnvelopeTimestamp(envelope.serverTimestamp);
  }

  async function onEnvelopeUnsealed({
    envelope,
  }: EnvelopeUnsealedEvent): Promise<void> {
    setInboxEnvelopeTimestamp(envelope.serverTimestamp);

    const ourAci = itemStorage.user.getAci();
    if (
      envelope.sourceServiceId !== ourAci &&
      isAciString(envelope.sourceServiceId)
    ) {
      const { mergePromises, conversation } =
        window.ConversationController.maybeMergeContacts({
          e164: envelope.source,
          aci: envelope.sourceServiceId,
          reason: `onEnvelopeUnsealed(${envelope.timestamp})`,
        });

      if (mergePromises.length > 0) {
        await Promise.all(mergePromises);
      }

      if (envelope.reportingToken) {
        await conversation.updateReportingToken(envelope.reportingToken);
      }
    }
  }

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  async function onMessageReceived(event: MessageEvent): Promise<void> {
    const { data, confirm } = event;

    const messageDescriptor = getMessageDescriptor({
      // 'message' event: for 1:1 converations, the conversation is same as sender
      destinationE164: data.source,
      destinationServiceId: data.sourceAci,
      envelopeId: data.envelopeId,
      message: data.message,
      source: data.sourceAci ?? data.source,
      sourceDevice: data.sourceDevice,
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

    if (isIncoming(message.attributes)) {
      const sender = getAuthor(message.attributes);
      strictAssert(sender, 'MessageModel has no sender');

      const serviceIdKind = itemStorage.user.getOurServiceIdKind(
        data.destinationServiceId
      );

      if (
        serviceIdKind === ServiceIdKind.PNI &&
        !sender.get('shareMyPhoneNumber')
      ) {
        log.info(
          'onMessageReceived: setting shareMyPhoneNumber ' +
            `for ${sender.idForLogging()}`
        );
        sender.set({ shareMyPhoneNumber: true });
        drop(DataWriter.updateConversation(sender.attributes));
      }

      if (!message.get('unidentifiedDeliveryReceived')) {
        drop(
          profileKeyResponseQueue.add(() => {
            respondWithProfileKeyBatcher.add(sender);
          })
        );
      }
    }

    if (data.message.reaction) {
      strictAssert(
        data.message.reaction.targetAuthorAci,
        'Reaction without targetAuthorAci'
      );
      const targetAuthorAci = normalizeAci(
        data.message.reaction.targetAuthorAci,
        'DataMessage.Reaction.targetAuthorAci'
      );

      const { reaction, timestamp } = data.message;

      if (!isValidReactionEmoji(reaction.emoji)) {
        log.warn('Received an invalid reaction emoji. Dropping it');
        confirm();
        return;
      }

      strictAssert(
        reaction.targetTimestamp,
        'Reaction without targetTimestamp'
      );
      const { conversation: fromConversation } =
        window.ConversationController.maybeMergeContacts({
          e164: data.source,
          aci: data.sourceAci,
          reason: 'onMessageReceived:reaction',
        });
      strictAssert(fromConversation, 'Reaction without fromConversation');

      log.info('Queuing incoming reaction for', reaction.targetTimestamp);
      const attributes: ReactionAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        emoji: reaction.emoji,
        fromId: fromConversation.id,
        remove: reaction.remove,
        source: ReactionSource.FromSomeoneElse,
        generatedMessageForStoryReaction: message,
        targetAuthorAci,
        targetTimestamp: reaction.targetTimestamp,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };

      drop(Reactions.onReaction(attributes));
      return;
    }

    if (data.message.pollVote) {
      if (!isPollReceiveEnabled()) {
        log.warn('Dropping PollVote because the flag is disabled');
        confirm();
        return;
      }
      const { pollVote, timestamp } = data.message;

      const parsed = safeParsePartial(PollVoteSchema, pollVote);
      if (!parsed.success) {
        log.warn(
          'Dropping PollVote due to validation error:',
          parsed.error.flatten()
        );
        confirm();
        return;
      }

      const validatedVote = parsed.data;
      const targetAuthorAci = normalizeAci(
        validatedVote.targetAuthorAci,
        'DataMessage.PollVote.targetAuthorAci'
      );

      const { conversation: fromConversation } =
        window.ConversationController.maybeMergeContacts({
          e164: data.source,
          aci: data.sourceAci,
          reason: 'onMessageReceived:pollVote',
        });
      strictAssert(fromConversation, 'PollVote without fromConversation');

      log.info('Queuing incoming poll vote for', pollVote.targetTimestamp);
      const attributes: PollVoteAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        fromConversationId: fromConversation.id,
        source: Polls.PollSource.FromSomeoneElse,
        targetAuthorAci,
        targetTimestamp: validatedVote.targetTimestamp,
        optionIndexes: validatedVote.optionIndexes,
        voteCount: validatedVote.voteCount,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };

      drop(Polls.onPollVote(attributes));
      return;
    }

    if (data.message.pollTerminate) {
      if (!isPollReceiveEnabled()) {
        log.warn('Dropping PollTerminate because the flag is disabled');
        confirm();
        return;
      }
      const { pollTerminate, timestamp } = data.message;

      const parsedTerm = safeParsePartial(PollTerminateSchema, pollTerminate);
      if (!parsedTerm.success) {
        log.warn(
          'Dropping PollTerminate due to validation error:',
          parsedTerm.error.flatten()
        );
        confirm();
        return;
      }

      const { conversation: fromConversation } =
        window.ConversationController.maybeMergeContacts({
          e164: data.source,
          aci: data.sourceAci,
          reason: 'onMessageReceived:pollTerminate',
        });
      strictAssert(fromConversation, 'PollTerminate without fromConversation');

      log.info(
        'Queuing incoming poll termination for',
        pollTerminate.targetTimestamp
      );
      const attributes: PollTerminateAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        fromConversationId: fromConversation.id,
        source: Polls.PollSource.FromSomeoneElse,
        targetTimestamp: parsedTerm.data.targetTimestamp,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };

      drop(Polls.onPollTerminate(attributes));
      return;
    }

    if (data.message.delete) {
      const { delete: del } = data.message;
      log.info('Queuing incoming DOE for', del.targetSentTimestamp);

      strictAssert(
        del.targetSentTimestamp,
        'Delete missing targetSentTimestamp'
      );
      strictAssert(data.serverTimestamp, 'Delete missing serverTimestamp');
      const { conversation: fromConversation } =
        window.ConversationController.maybeMergeContacts({
          e164: data.source,
          aci: data.sourceAci,
          reason: 'onMessageReceived:delete',
        });
      strictAssert(fromConversation, 'Delete missing fromConversation');

      const attributes: DeleteAttributesType = {
        envelopeId: data.envelopeId,
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: fromConversation.id,
        removeFromMessageReceiverCache: confirm,
      };
      drop(Deletes.onDelete(attributes));

      return;
    }

    if (data.message.editedMessageTimestamp) {
      const { editedMessageTimestamp } = data.message;

      strictAssert(editedMessageTimestamp, 'Edit missing targetSentTimestamp');
      const { conversation: fromConversation } =
        window.ConversationController.maybeMergeContacts({
          aci: data.sourceAci,
          e164: data.source,
          reason: 'onMessageReceived:edit',
        });
      strictAssert(fromConversation, 'Edit missing fromConversation');

      log.info('Queuing incoming edit for', {
        editedMessageTimestamp,
        sentAt: data.timestamp,
      });

      const editAttributes: EditAttributesType = {
        envelopeId: data.envelopeId,
        conversationId: message.attributes.conversationId,
        fromId: fromConversation.id,
        fromDevice: data.sourceDevice ?? 1,
        message: copyDataMessageIntoMessage(data.message, message.attributes),
        targetSentTimestamp: editedMessageTimestamp,
        removeFromMessageReceiverCache: confirm,
      };

      drop(Edits.onEdit(editAttributes));

      return;
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      confirm();
      return;
    }

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    drop(handleDataMessage(message, data.message, event.confirm));
  }

  async function onProfileKey({
    data,
    reason,
    confirm,
  }: ProfileKeyUpdateEvent): Promise<void> {
    const logId = `onProfileKey/${reason}`;
    const { conversation } = window.ConversationController.maybeMergeContacts({
      aci: data.sourceAci,
      e164: data.source,
      reason: logId,
    });
    const idForLogging = getConversationIdForLogging(conversation.attributes);

    if (!data.profileKey) {
      log.error(
        `${logId}: missing profileKey for ${idForLogging}`,
        data.profileKey
      );
      confirm();
      return;
    }

    const hasChanged = await conversation.setProfileKey(data.profileKey, {
      reason: `onProfileKey/${reason}`,
    });

    if (hasChanged) {
      drop(conversation.getProfiles());
    }

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

    conversation.enableProfileSharing({
      reason: 'handleMessageSentProfileUpdate',
    });
    await DataWriter.updateConversation(conversation.attributes);

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
    await me.setProfileKey(profileKey, {
      reason: 'handleMessageSentProfileUpdate',
    });

    return confirm();
  }

  async function createSentMessage(
    data: SentEventData,
    descriptor: MessageDescriptor
  ) {
    const now = Date.now();
    const timestamp = data.timestamp || now;
    const logId = `createSentMessage(${timestamp})`;

    const ourId = window.ConversationController.getOurConversationIdOrThrow();

    const { unidentifiedStatus = [] } = data;

    const sendStateByConversationId: SendStateByConversationId = {
      [ourId]: {
        status: SendStatus.Sent,
        updatedAt: timestamp,
      },
    };

    for (const {
      destinationServiceId,
      isAllowedToReplyToStory,
    } of unidentifiedStatus) {
      const conversation =
        window.ConversationController.get(destinationServiceId);
      if (!conversation || conversation.id === ourId) {
        continue;
      }

      sendStateByConversationId[conversation.id] = {
        isAllowedToReplyToStory,
        status: SendStatus.Sent,
        updatedAt: timestamp,
      };
    }

    await pMap(
      unidentifiedStatus,
      async ({ destinationServiceId, destinationPniIdentityKey }) => {
        if (!Bytes.isNotEmpty(destinationPniIdentityKey)) {
          return;
        }

        if (!isPniString(destinationServiceId)) {
          log.warn(
            `${logId}: received an destinationPniIdentityKey for ` +
              `an invalid PNI: ${destinationServiceId}`
          );
          return;
        }

        const changed = await updateIdentityKey(
          destinationPniIdentityKey,
          destinationServiceId,
          {
            noOverwrite: true,
          }
        );
        if (changed) {
          log.info(
            `${logId}: Updated identity key for ${destinationServiceId}`
          );
        }
      },
      { concurrency: 10 }
    );

    let unidentifiedDeliveries: Array<string> = [];
    if (unidentifiedStatus.length) {
      unidentifiedDeliveries = unidentifiedStatus
        .filter(item => Boolean(item.unidentified))
        .map(item => item.destinationServiceId)
        .filter(isNotNil);
    }

    const partialMessage: MessageAttributesType = {
      ...generateMessageId(data.receivedAtCounter),

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
      seenStatus: SeenStatus.NotApplicable,
      sendStateByConversationId,
      sent_at: timestamp,
      serverTimestamp: data.serverTimestamp,
      source: itemStorage.user.getNumber(),
      sourceDevice: data.device,
      sourceServiceId: itemStorage.user.getAci(),
      timestamp,
      type: data.message.isStory ? 'story' : 'outgoing',
      storyDistributionListId: data.storyDistributionListId,
      unidentifiedDeliveries,
    };

    return new MessageModel(partialMessage);
  }

  // Works with 'sent' and 'message' data sent from MessageReceiver
  const getMessageDescriptor = ({
    destinationE164,
    destinationServiceId,
    envelopeId,
    message,
    source,
    sourceDevice,
  }: {
    destinationE164?: string;
    destinationServiceId?: ServiceIdString;
    envelopeId: string;
    message: ProcessedDataMessage;
    source: string | undefined;
    sourceDevice: number | undefined;
  }): MessageDescriptor => {
    const logId = `getMessageDescriptor/${source}.${sourceDevice}-${envelopeId}`;

    if (message.groupV2) {
      const { id } = message.groupV2;
      if (!id) {
        throw new Error(`${logId}: GroupV2 data was missing an id`);
      }

      // First we check for an existing GroupV2 group
      const groupV2 = window.ConversationController.get(id);
      if (groupV2) {
        return {
          type: GROUP,
          id: groupV2.id,
        };
      }

      // Then check for V1 group with matching derived GV2 id
      const groupV1 = window.ConversationController.getByDerivedGroupV2Id(id);
      if (groupV1) {
        return {
          type: GROUP,
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
        type: GROUP,
        id: conversationId,
      };
    }

    const id = destinationServiceId || destinationE164;
    strictAssert(
      id,
      `${logId}: We need some sort of destination for the conversation`
    );
    const conversation = window.ConversationController.getOrCreate(
      id,
      'private'
    );

    return {
      type: PRIVATE,
      id: conversation.id,
    };
  };

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  async function onSentMessage(event: SentEvent): Promise<void> {
    const { data, confirm } = event;

    const source = itemStorage.user.getNumber();
    const sourceServiceId = itemStorage.user.getAci();
    strictAssert(source && sourceServiceId, 'Missing user number and uuid');

    // Make sure destination conversation is created before we hit getMessageDescriptor
    if (
      data.destinationServiceId &&
      data.destinationServiceId !== sourceServiceId
    ) {
      const { mergePromises } =
        window.ConversationController.maybeMergeContacts({
          e164: data.destinationE164,
          aci: isAciString(data.destinationServiceId)
            ? data.destinationServiceId
            : undefined,
          pni: isPniString(data.destinationServiceId)
            ? data.destinationServiceId
            : undefined,
          reason: `onSentMessage(${data.timestamp})`,
        });

      if (mergePromises.length > 0) {
        await Promise.all(mergePromises);
      }
    }

    const messageDescriptor = getMessageDescriptor({
      ...data,
      source: sourceServiceId,
      sourceDevice: data.device,
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

    const message = await createSentMessage(data, messageDescriptor);

    if (data.message.reaction) {
      strictAssert(
        data.message.reaction.targetAuthorAci,
        'Reaction without targetAuthorAci'
      );
      const targetAuthorAci = normalizeAci(
        data.message.reaction.targetAuthorAci,
        'DataMessage.Reaction.targetAuthorAci'
      );

      const { reaction, timestamp } = data.message;
      strictAssert(
        reaction.targetTimestamp,
        'Reaction without targetAuthorAci'
      );

      if (!isValidReactionEmoji(reaction.emoji)) {
        log.warn('Received an invalid reaction emoji. Dropping it');
        confirm();
        return;
      }

      log.info('Queuing sent reaction for', reaction.targetTimestamp);
      const attributes: ReactionAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        emoji: reaction.emoji,
        fromId: window.ConversationController.getOurConversationIdOrThrow(),
        remove: reaction.remove,
        source: ReactionSource.FromSync,
        generatedMessageForStoryReaction: message,
        targetAuthorAci,
        targetTimestamp: reaction.targetTimestamp,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };
      drop(Reactions.onReaction(attributes));
      return;
    }

    if (data.message.pollVote) {
      if (!isPollReceiveEnabled()) {
        log.warn('Dropping PollVote because the flag is disabled');
        confirm();
        return;
      }
      const { pollVote, timestamp } = data.message;

      const parsed = safeParsePartial(PollVoteSchema, pollVote);
      if (!parsed.success) {
        log.warn(
          'Dropping PollVote (sync) due to validation error:',
          parsed.error.flatten()
        );
        confirm();
        return;
      }

      const validatedVote = parsed.data;
      const targetAuthorAci = normalizeAci(
        validatedVote.targetAuthorAci,
        'DataMessage.PollVote.targetAuthorAci'
      );

      const ourConversationId =
        window.ConversationController.getOurConversationIdOrThrow();

      log.info('Queuing sync poll vote for', pollVote.targetTimestamp);
      const attributes: PollVoteAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        fromConversationId: ourConversationId,
        source: Polls.PollSource.FromSync,
        targetAuthorAci,
        targetTimestamp: validatedVote.targetTimestamp,
        optionIndexes: validatedVote.optionIndexes,
        voteCount: validatedVote.voteCount,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };

      drop(Polls.onPollVote(attributes));
      return;
    }

    if (data.message.pollTerminate) {
      if (!isPollReceiveEnabled()) {
        log.warn('Dropping PollTerminate because the flag is disabled');
        confirm();
        return;
      }
      const { pollTerminate, timestamp } = data.message;

      const parsedTerm = safeParsePartial(PollTerminateSchema, pollTerminate);
      if (!parsedTerm.success) {
        log.warn(
          'Dropping PollTerminate (sync) due to validation error:',
          parsedTerm.error.flatten()
        );
        confirm();
        return;
      }

      const ourConversationId =
        window.ConversationController.getOurConversationIdOrThrow();

      log.info(
        'Queuing sync poll termination for',
        pollTerminate.targetTimestamp
      );
      const attributes: PollTerminateAttributesType = {
        envelopeId: data.envelopeId,
        removeFromMessageReceiverCache: confirm,
        fromConversationId: ourConversationId,
        source: Polls.PollSource.FromSync,
        targetTimestamp: parsedTerm.data.targetTimestamp,
        receivedAtDate: data.receivedAtDate,
        timestamp,
      };

      drop(Polls.onPollTerminate(attributes));
      return;
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
        envelopeId: data.envelopeId,
        targetSentTimestamp: del.targetSentTimestamp,
        serverTimestamp: data.serverTimestamp,
        fromId: window.ConversationController.getOurConversationIdOrThrow(),
        removeFromMessageReceiverCache: confirm,
      };
      drop(Deletes.onDelete(attributes));
      return;
    }

    if (data.message.editedMessageTimestamp) {
      const { editedMessageTimestamp } = data.message;

      strictAssert(editedMessageTimestamp, 'Edit missing targetSentTimestamp');

      log.info('Queuing sent edit for', {
        editedMessageTimestamp,
        sentAt: data.timestamp,
      });

      const editAttributes: EditAttributesType = {
        envelopeId: data.envelopeId,
        conversationId: message.attributes.conversationId,
        fromId: window.ConversationController.getOurConversationIdOrThrow(),
        fromDevice: itemStorage.user.getDeviceId() ?? 1,
        message: copyDataMessageIntoMessage(data.message, message.attributes),
        targetSentTimestamp: editedMessageTimestamp,
        removeFromMessageReceiverCache: confirm,
      };

      drop(Edits.onEdit(editAttributes));
      return;
    }

    if (handleGroupCallUpdateMessage(data.message, messageDescriptor)) {
      event.confirm();
      return;
    }

    // Don't wait for handleDataMessage, as it has its own per-conversation queueing
    drop(
      handleDataMessage(message, data.message, event.confirm, {
        data,
      })
    );
  }

  type MessageDescriptor = {
    type: 'private' | 'group';
    id: string;
  };

  function initIncomingMessage(
    data: MessageEventData,
    descriptor: MessageDescriptor
  ) {
    assertDev(
      Boolean(data.receivedAtCounter),
      `Did not receive receivedAtCounter for message: ${data.timestamp}`
    );
    const partialMessage: MessageAttributesType = {
      ...generateMessageId(data.receivedAtCounter),

      canReplyToStory: data.message.isStory
        ? data.message.canReplyToStory
        : undefined,
      conversationId: descriptor.id,
      readStatus: ReadStatus.Unread,
      received_at_ms: data.receivedAtDate,
      seenStatus: SeenStatus.Unseen,
      sent_at: data.timestamp,
      serverGuid: data.serverGuid,
      serverTimestamp: data.serverTimestamp,
      source: data.source,
      sourceDevice: data.sourceDevice,
      sourceServiceId: data.sourceAci,
      timestamp: data.timestamp,
      type: data.message.isStory ? 'story' : 'incoming',
      unidentifiedDeliveryReceived: data.unidentifiedDeliveryReceived,
    };
    return new MessageModel(partialMessage);
  }

  // Returns `false` if this message isn't a group call message.
  function handleGroupCallUpdateMessage(
    message: ProcessedDataMessage,
    messageDescriptor: MessageDescriptor
  ): boolean {
    if (message.groupCallUpdate) {
      if (message.groupV2 && messageDescriptor.type === GROUP) {
        const conversationId = messageDescriptor.id;
        const callId =
          message.groupCallUpdate?.eraId != null
            ? getCallIdFromEra(message.groupCallUpdate.eraId)
            : null;
        log.info(
          'handleGroupCallUpdateMessage',
          message.timestamp,
          callId,
          conversationId
        );
        window.reduxActions.calling.peekNotConnectedGroupCall({
          callMode: CallMode.Group,
          conversationId,
        });
        if (callId != null) {
          drop(
            updateLocalGroupCallHistoryTimestamp(
              conversationId,
              callId,
              message.timestamp
            )
          );
        }
        return true;
      }
      log.warn(
        'Received a group call update for a conversation that is not a GV2 group. Ignoring that property and continuing.'
      );
    }
    return false;
  }

  async function unlinkAndDisconnect(): Promise<void> {
    window.Whisper.events.emit('unauthorized');

    log.warn(
      'unlinkAndDisconnect: Client is no longer authorized; ' +
        'deleting local configuration'
    );

    if (messageReceiver) {
      log.info('unlinkAndDisconnect: logging out');

      pauseProcessing('unlinkAndDisconnect');

      backupReady.reject(new Error('Aborted'));
      backupReady = explodePromise();

      await logout();
      await waitForAllBatchers();
    }

    void onEmpty({ isFromMessageReceiver: false });

    void Registration.remove();

    const NUMBER_ID_KEY = 'number_id';
    const UUID_ID_KEY = 'uuid_id';
    const PNI_KEY = 'pni';
    const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
    const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

    const previousNumberId = itemStorage.get(NUMBER_ID_KEY);
    const previousUuidId = itemStorage.get(UUID_ID_KEY);
    const previousPni = itemStorage.get(PNI_KEY);
    const lastProcessedIndex = itemStorage.get(LAST_PROCESSED_INDEX_KEY);
    const isMigrationComplete = itemStorage.get(IS_MIGRATION_COMPLETE_KEY);

    try {
      log.info('unlinkAndDisconnect: removing configuration');

      // We use username for integrity check
      const ourConversation =
        window.ConversationController.getOurConversation();
      if (ourConversation) {
        ourConversation.set({ username: undefined });
        await DataWriter.updateConversation(ourConversation.attributes);
      }

      // Then make sure outstanding conversation saves are flushed
      await DataWriter.flushUpdateConversationBatcher();

      // Then make sure that all previously-outstanding database saves are flushed
      await DataReader.getItemById('manifestVersion');

      // Finally, conversations in the database, and delete all config tables
      await signalProtocolStore.removeAllConfiguration();

      // These three bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
      if (previousNumberId !== undefined) {
        await itemStorage.put(NUMBER_ID_KEY, previousNumberId);
      }
      if (previousUuidId !== undefined) {
        await itemStorage.put(UUID_ID_KEY, previousUuidId);
      }
      if (previousPni !== undefined) {
        await itemStorage.put(PNI_KEY, previousPni);
      }

      // These two are important to ensure we don't rip through every message
      //   in the database attempting to upgrade it after starting up again.
      await itemStorage.put(
        IS_MIGRATION_COMPLETE_KEY,
        isMigrationComplete || false
      );
      if (lastProcessedIndex !== undefined) {
        await itemStorage.put(LAST_PROCESSED_INDEX_KEY, lastProcessedIndex);
      } else {
        await itemStorage.remove(LAST_PROCESSED_INDEX_KEY);
      }

      // Re-hydrate items from memory; removeAllConfiguration above changed database
      await itemStorage.fetch();

      log.info('unlinkAndDisconnect: Successfully cleared local configuration');
    } catch (eraseError) {
      log.error(
        'unlinkAndDisconnect: Something went wrong clearing ' +
          'local configuration',
        Errors.toLogFormat(eraseError)
      );
    } finally {
      await Registration.markEverDone();

      if (window.SignalCI) {
        window.SignalCI.handleEvent('unlinkCleanupComplete', null);
      }
    }
  }

  function onError(ev: ErrorEvent): void {
    const { error } = ev;
    log.error('onError:', Errors.toLogFormat(error));

    if (
      error instanceof HTTPError &&
      (error.code === 401 || error.code === 403)
    ) {
      void unlinkAndDisconnect();
      return;
    }

    log.warn('onError: Doing nothing with incoming error');
  }

  function onViewOnceOpenSync(ev: ViewOnceOpenSyncEvent): void {
    const { sourceAci, timestamp } = ev;
    log.info(`view once open sync ${sourceAci} ${timestamp}`);
    strictAssert(sourceAci, 'ViewOnceOpen without sourceAci');
    strictAssert(timestamp, 'ViewOnceOpen without timestamp');

    const attributes: ViewOnceOpenSyncAttributesType = {
      removeFromMessageReceiverCache: ev.confirm,
      sourceAci,
      timestamp,
    };
    drop(ViewOnceOpenSyncs.onSync(attributes));
  }

  function onFetchLatestSync(ev: FetchLatestEvent): void {
    // Don't block on fetchLatestSync events
    drop(doFetchLatestSync(ev));
  }

  async function doFetchLatestSync(ev: FetchLatestEvent): Promise<void> {
    const { eventType } = ev;

    const FETCH_LATEST_ENUM = Proto.SyncMessage.FetchLatest.Type;
    switch (eventType) {
      case FETCH_LATEST_ENUM.LOCAL_PROFILE: {
        log.info('onFetchLatestSync: fetching latest local profile');
        const ourAci = itemStorage.user.getAci() ?? null;
        const ourE164 = itemStorage.user.getNumber() ?? null;
        await getProfile({
          serviceId: ourAci,
          e164: ourE164,
          groupId: null,
        });
        break;
      }
      case FETCH_LATEST_ENUM.STORAGE_MANIFEST:
        log.info('onFetchLatestSync: fetching latest manifest');
        StorageService.runStorageServiceSyncJob({ reason: 'syncFetchLatest' });
        break;
      case FETCH_LATEST_ENUM.SUBSCRIPTION_STATUS:
        log.info('onFetchLatestSync: fetching latest subscription status');
        areWeASubscriberService.update(itemStorage, {
          isOnline,
          getHasSubscription,
        });
        break;
      default:
        log.info(`onFetchLatestSync: Unknown type encountered ${eventType}`);
    }

    ev.confirm();
  }

  async function onKeysSync(ev: KeysEvent) {
    const { accountEntropyPool, masterKey, mediaRootBackupKey } = ev;

    const prevMasterKeyBase64 = itemStorage.get('masterKey');
    const prevMasterKey = prevMasterKeyBase64
      ? Bytes.fromBase64(prevMasterKeyBase64)
      : undefined;
    const prevAccountEntropyPool = itemStorage.get('accountEntropyPool');

    let derivedMasterKey = masterKey;
    if (derivedMasterKey == null && accountEntropyPool) {
      derivedMasterKey = deriveMasterKey(accountEntropyPool);
      if (!Bytes.areEqual(derivedMasterKey, prevMasterKey)) {
        log.info('onKeysSync: deriving master key from account entropy pool');
      }
    }

    if (accountEntropyPool == null) {
      if (prevAccountEntropyPool != null) {
        log.warn('onKeysSync: deleting window.accountEntropyPool');
      }
      await itemStorage.remove('accountEntropyPool');
    } else {
      if (prevAccountEntropyPool !== accountEntropyPool) {
        log.info('onKeysSync: updating accountEntropyPool');
      }
      await itemStorage.put('accountEntropyPool', accountEntropyPool);
    }

    if (derivedMasterKey == null) {
      if (prevMasterKey != null) {
        log.warn('onKeysSync: deleting window.masterKey');
      }
      await itemStorage.remove('masterKey');
    } else {
      if (!Bytes.areEqual(derivedMasterKey, prevMasterKey)) {
        log.info('onKeysSync: updating masterKey');
      }
      // Override provided storageServiceKey because it is deprecated.
      await itemStorage.put('masterKey', Bytes.toBase64(derivedMasterKey));
    }

    const prevMediaRootBackupKey = itemStorage.get('backupMediaRootKey');
    if (mediaRootBackupKey == null) {
      if (prevMediaRootBackupKey != null) {
        log.warn('onKeysSync: deleting window.backupMediaRootKey');
      }
      await itemStorage.remove('backupMediaRootKey');
    } else {
      if (!Bytes.areEqual(prevMediaRootBackupKey, mediaRootBackupKey)) {
        log.info('onKeysSync: updating window.backupMediaRootKey');
      }
      await itemStorage.put('backupMediaRootKey', mediaRootBackupKey);
    }

    if (derivedMasterKey != null) {
      const storageServiceKey = deriveStorageServiceKey(derivedMasterKey);
      const storageServiceKeyBase64 = Bytes.toBase64(storageServiceKey);
      if (itemStorage.get('storageKey') === storageServiceKeyBase64) {
        log.info(
          "onKeysSync: storage service key didn't change, " +
            'fetching manifest anyway'
        );
      } else {
        log.info(
          'onKeysSync: updated storage service key, erasing state and fetching'
        );
        try {
          await itemStorage.put('storageKey', storageServiceKeyBase64);
          await StorageService.eraseAllStorageServiceState({
            keepUnknownFields: true,
          });
        } catch (error) {
          log.info(
            'onKeysSync: Failed to erase storage service data, starting sync job anyway',
            Errors.toLogFormat(error)
          );
        }
      }

      await StorageService.runStorageServiceSyncJob({ reason: 'onKeysSync' });
    }
    ev.confirm();
  }

  function onMessageRequestResponse(ev: MessageRequestResponseEvent): void {
    const {
      threadAci,
      groupV2Id,
      messageRequestResponseType,
      receivedAtCounter,
      receivedAtMs,
      sentAt,
    } = ev;

    log.info('onMessageRequestResponse', {
      threadAci,
      groupV2Id: `groupv2(${groupV2Id})`,
      messageRequestResponseType,
    });

    strictAssert(
      messageRequestResponseType,
      'onMessageRequestResponse: missing type'
    );

    strictAssert(ev.envelopeId, 'onMessageRequestResponse: no envelope id');

    const attributes: MessageRequestAttributesType = {
      envelopeId: ev.envelopeId,
      removeFromMessageReceiverCache: ev.confirm,
      threadAci,
      groupV2Id,
      receivedAtCounter,
      receivedAtMs,
      sentAt,
      sourceType: MessageRequestResponseSource.MRR_SYNC,
      type: messageRequestResponseType,
    };
    drop(MessageRequests.onResponse(attributes));
  }

  async function onReadReceipt(event: Readonly<ReadEvent>): Promise<void> {
    return onReadOrViewReceipt({
      logTitle: 'read receipt',
      event,
      type: MessageReceipts.messageReceiptTypeSchema.enum.Read,
    });
  }

  async function onViewReceipt(event: Readonly<ViewEvent>): Promise<void> {
    return onReadOrViewReceipt({
      logTitle: 'view receipt',
      event,
      type: MessageReceipts.messageReceiptTypeSchema.enum.View,
    });
  }

  async function onReadOrViewReceipt({
    event,
    logTitle,
    type,
  }: Readonly<{
    event: ReadEvent | ViewEvent;
    logTitle: string;
    type: 'Read' | 'View';
  }>): Promise<void> {
    const { receipts, envelopeId, envelopeTimestamp, confirm } = event;
    const logId = `onReadOrViewReceipt(type=${type}, envelope=${envelopeTimestamp}, envelopeId=${envelopeId})`;

    const syncTasks = receipts
      .map((receipt): SyncTaskType | undefined => {
        const {
          timestamp,
          source,
          sourceServiceId,
          sourceDevice,
          wasSentEncrypted,
        } = receipt;
        const sourceConversation = window.ConversationController.lookupOrCreate(
          {
            serviceId: sourceServiceId,
            e164: source,
            reason: `onReadOrViewReceipt(${envelopeTimestamp})`,
          }
        );

        log.info(
          logTitle,
          `${sourceServiceId || source}.${sourceDevice}`,
          envelopeTimestamp,
          'for sent message',
          timestamp
        );

        if (!sourceConversation) {
          log.error(`${logId}: Failed to create conversation`);
          return undefined;
        }
        if (!isServiceIdString(sourceServiceId)) {
          log.error(`${logId}: Missing sourceServiceId`);
          return undefined;
        }
        if (!sourceDevice) {
          log.error(`${logId}: Missing sourceDevice`);
          return undefined;
        }

        const data: ReceiptSyncTaskType = {
          messageSentAt: timestamp,
          receiptTimestamp: envelopeTimestamp,
          sourceConversationId: sourceConversation.id,
          sourceServiceId,
          sourceDevice,
          type,
          wasSentEncrypted,
        };
        return {
          id: generateUuid(),
          attempts: 1,
          createdAt: Date.now(),
          data,
          envelopeId,
          sentAt: envelopeTimestamp,
          type,
        };
      })
      .filter(isNotNil);

    log.info(`${logId}: Saving ${syncTasks.length} sync tasks`);

    await DataWriter.saveSyncTasks(syncTasks);

    confirm();

    log.info(`${logId}: Queuing ${syncTasks.length} sync tasks`);

    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

    log.info(`${logId}: Done`);
  }

  async function onReadSync(ev: ReadSyncEvent): Promise<void> {
    const { reads, envelopeTimestamp, envelopeId, confirm } = ev;
    const logId = `onReadSync(envelope=${envelopeTimestamp}, envelopeId=${envelopeId})`;

    const syncTasks = reads
      .map((read): SyncTaskType | undefined => {
        const { sender, senderAci, timestamp } = read;
        const readAt = envelopeTimestamp;
        const { conversation: senderConversation } =
          window.ConversationController.maybeMergeContacts({
            aci: senderAci,
            e164: sender,
            reason: 'onReadSync',
          });
        const senderId = senderConversation?.id;

        log.info(
          'read sync',
          sender,
          senderAci,
          envelopeTimestamp,
          senderId,
          'for message',
          timestamp
        );

        if (!senderId) {
          log.error(`${logId}: missing senderId`);
          return undefined;
        }
        if (!senderAci) {
          log.error(`${logId}: missing senderAci`);
          return undefined;
        }
        if (!timestamp) {
          log.error(`${logId}: missing timestamp`);
          return undefined;
        }

        const data: ReadSyncTaskType = {
          type: 'ReadSync',
          senderId,
          sender,
          senderAci,
          timestamp,
          readAt,
        };
        return {
          id: generateUuid(),
          attempts: 1,
          createdAt: Date.now(),
          data,
          envelopeId,
          sentAt: envelopeTimestamp,
          type: 'ReadSync',
        };
      })
      .filter(isNotNil);

    log.info(`${logId}: Saving ${syncTasks.length} sync tasks`);

    await DataWriter.saveSyncTasks(syncTasks);

    confirm();

    log.info(`${logId}: Queuing ${syncTasks.length} sync tasks`);

    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

    log.info(`${logId}: Done`);
  }

  async function onViewSync(ev: ViewSyncEvent): Promise<void> {
    const { envelopeTimestamp, envelopeId, views, confirm } = ev;
    const logId = `onViewSync=(envelope=${envelopeTimestamp}, envelopeId=${envelopeId})`;

    const syncTasks = views
      .map((view): SyncTaskType | undefined => {
        const { senderAci, senderE164, timestamp } = view;

        const { conversation: senderConversation } =
          window.ConversationController.maybeMergeContacts({
            e164: senderE164,
            aci: senderAci,
            reason: 'onViewSync',
          });
        const senderId = senderConversation?.id;

        log.info(
          'view sync',
          senderE164,
          senderAci,
          envelopeTimestamp,
          senderId,
          'for message',
          timestamp
        );

        if (!senderId) {
          log.error(`${logId}: missing senderId`);
          return undefined;
        }
        if (!senderAci) {
          log.error(`${logId}: missing senderAci`);
          return undefined;
        }
        if (!timestamp) {
          log.error(`${logId}: missing timestamp`);
          return undefined;
        }

        const data: ViewSyncTaskType = {
          type: 'ViewSync',
          senderId,
          senderE164,
          senderAci,
          timestamp,
          viewedAt: envelopeTimestamp,
        };
        return {
          id: generateUuid(),
          attempts: 1,
          createdAt: Date.now(),
          data,
          envelopeId,
          sentAt: envelopeTimestamp,
          type: 'ViewSync',
        };
      })
      .filter(isNotNil);

    log.info(`${logId}: Saving ${syncTasks.length} sync tasks`);

    await DataWriter.saveSyncTasks(syncTasks);

    confirm();

    log.info(`${logId}: Queuing ${syncTasks.length} sync tasks`);

    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

    log.info(`${logId}: Done`);
  }

  async function onDeliveryReceipt(ev: DeliveryEvent): Promise<void> {
    const { deliveryReceipts, envelopeId, envelopeTimestamp, confirm } = ev;
    const logId = `onDeliveryReceipt(envelope=${envelopeTimestamp}, envelopeId=${envelopeId})`;

    strictAssert(envelopeTimestamp, `${logId}: missing envelopeTimestamp`);
    strictAssert(envelopeTimestamp, `${logId}: missing envelopeId`);

    const syncTasks = deliveryReceipts
      .map((deliveryReceipt): SyncTaskType | undefined => {
        const {
          sourceServiceId,
          source,
          sourceDevice,
          timestamp,
          wasSentEncrypted,
        } = deliveryReceipt;

        const sourceConversation = window.ConversationController.lookupOrCreate(
          {
            serviceId: sourceServiceId,
            e164: source,
            reason: `onDeliveryReceipt(${envelopeTimestamp})`,
          }
        );

        log.info(
          'delivery receipt from',
          `${sourceServiceId || source}.${sourceDevice}`,
          envelopeTimestamp,
          'for sent message',
          timestamp,
          `wasSentEncrypted=${wasSentEncrypted}`
        );

        if (!isServiceIdString(sourceServiceId)) {
          log.error(`${logId}: missing valid sourceServiceId`);
          return undefined;
        }
        if (!sourceDevice) {
          log.error(`${logId}: missing sourceDevice`);
          return undefined;
        }
        if (!sourceConversation) {
          log.error(`${logId}: missing conversation`);
          return undefined;
        }

        const data: ReceiptSyncTaskType = {
          messageSentAt: timestamp,
          receiptTimestamp: envelopeTimestamp,
          sourceConversationId: sourceConversation.id,
          sourceServiceId,
          sourceDevice,
          type: MessageReceipts.messageReceiptTypeSchema.enum.Delivery,
          wasSentEncrypted,
        };
        return {
          id: generateUuid(),
          attempts: 1,
          createdAt: Date.now(),
          data,
          envelopeId,
          sentAt: envelopeTimestamp,
          type: 'Delivery',
        };
      })
      .filter(isNotNil);

    log.info(`${logId}: Saving ${syncTasks.length} sync tasks`);

    await DataWriter.saveSyncTasks(syncTasks);

    confirm();

    log.info(`${logId}: Queuing ${syncTasks.length} sync tasks`);

    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

    log.info(`${logId}: Done`);
  }

  async function onDeleteForMeSync(ev: DeleteForMeSyncEvent) {
    const { confirm, timestamp, envelopeId, deleteForMeSync } = ev;
    const logId = `onDeleteForMeSync(${timestamp})`;

    // The user clearly knows about this feature; they did it on another device!
    drop(itemStorage.put('localDeleteWarningShown', true));

    log.info(`${logId}: Saving ${deleteForMeSync.length} sync tasks`);

    const now = Date.now();
    const syncTasks = deleteForMeSync.map(item => ({
      id: generateUuid(),
      attempts: 1,
      createdAt: now,
      data: item,
      envelopeId,
      sentAt: timestamp,
      type: item.type,
    }));
    await DataWriter.saveSyncTasks(syncTasks);

    confirm();

    log.info(`${logId}: Queuing ${syncTasks.length} sync tasks`);

    await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

    log.info(`${logId}: Done`);
  }
  async function onAttachmentBackfillResponseSync(
    ev: AttachmentBackfillResponseSyncEvent
  ) {
    const { confirm } = ev;
    await AttachmentDownloadManager.handleBackfillResponse(ev);
    confirm();
  }
}

window.startApp = startApp;
