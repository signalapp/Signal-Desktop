// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, groupBy, throttle } from 'lodash';
import { render } from 'react-dom';
import PQueue from 'p-queue';
import pMap from 'p-map';
import { v7 as generateUuid } from 'uuid';
import { batch as batchDispatch } from 'react-redux';

import * as Registration from './util/registration';
import MessageReceiver from './textsecure/MessageReceiver';
import type {
  SessionResetsType,
  ProcessedDataMessage,
} from './textsecure/Types.d';
import { HTTPError } from './textsecure/Errors';
import createTaskWithTimeout, {
  suspendTasksWithTimeout,
  resumeTasksWithTimeout,
  reportLongRunningTasks,
} from './textsecure/TaskWithTimeout';
import type { MessageAttributesType } from './model-types.d';
import * as Bytes from './Bytes';
import * as Timers from './Timers';
import * as indexedDb from './indexeddb';
import type { MenuOptionsType } from './types/menu';
import type { Receipt } from './types/Receipt';
import { ReceiptType } from './types/Receipt';
import { SocketStatus } from './types/SocketStatus';
import { DEFAULT_CONVERSATION_COLOR } from './types/Colors';
import { ThemeType } from './types/Util';
import { ToastType } from './types/Toast';
import { ChallengeHandler } from './challenge';
import * as durations from './util/durations';
import { drop } from './util/drop';
import { explodePromise } from './util/explodePromise';
import type { ExplodePromiseResultType } from './util/explodePromise';
import { isWindowDragElement } from './util/isWindowDragElement';
import { assertDev, strictAssert } from './util/assert';
import { filter } from './util/iterables';
import { isNotNil } from './util/isNotNil';
import { isBackupEnabled } from './util/isBackupEnabled';
import { setAppLoadingScreenMessage } from './setAppLoadingScreenMessage';
import { IdleDetector } from './IdleDetector';
import {
  initialize as initializeExpiringMessageService,
  update as updateExpiringMessagesService,
} from './services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from './services/tapToViewMessagesDeletionService';
import { senderCertificateService } from './services/senderCertificate';
import { GROUP_CREDENTIALS_KEY } from './services/groupCredentialFetcher';
import * as KeyboardLayout from './services/keyboardLayout';
import * as StorageService from './services/storage';
import { usernameIntegrity } from './services/usernameIntegrity';
import { updateIdentityKey } from './services/profiles';
import { RoutineProfileRefresher } from './routineProfileRefresh';
import { isOlderThan } from './util/timestamp';
import { isValidReactionEmoji } from './reactions/isValidReactionEmoji';
import type { ConversationModel } from './models/conversations';
import { getAuthor, isIncoming } from './messages/helpers';
import { migrateBatchOfMessages } from './messages/migrateMessageData';
import { createBatcher } from './util/batcher';
import {
  initializeAllJobQueues,
  shutdownAllJobQueues,
} from './jobs/initializeAllJobQueues';
import { removeStorageKeyJobQueue } from './jobs/removeStorageKeyJobQueue';
import { ourProfileKeyService } from './services/ourProfileKey';
import { notificationService } from './services/notifications';
import { areWeASubscriberService } from './services/areWeASubscriber';
import { onContactSync, setIsInitialContactSync } from './services/contactSync';
import { startTimeTravelDetector } from './util/startTimeTravelDetector';
import { shouldRespondWithProfileKey } from './util/shouldRespondWithProfileKey';
import { LatestQueue } from './util/LatestQueue';
import { parseIntOrThrow } from './util/parseIntOrThrow';
import { getProfile } from './util/getProfile';
import type {
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
} from './textsecure/messageReceiverEvents';
import type { WebAPIType } from './textsecure/WebAPI';
import * as KeyChangeListener from './textsecure/KeyChangeListener';
import { UpdateKeysListener } from './textsecure/UpdateKeysListener';
import { isDirectConversation } from './util/whatTypeOfConversation';
import { BackOff, FIBONACCI_TIMEOUTS } from './util/BackOff';
import { AppViewType } from './state/ducks/app';
import { areAnyCallsActiveOrRinging } from './state/selectors/calling';
import { badgeImageFileDownloader } from './badges/badgeImageFileDownloader';
import * as Deletes from './messageModifiers/Deletes';
import * as Edits from './messageModifiers/Edits';
import * as MessageReceipts from './messageModifiers/MessageReceipts';
import * as MessageRequests from './messageModifiers/MessageRequests';
import * as Reactions from './messageModifiers/Reactions';
import * as ViewOnceOpenSyncs from './messageModifiers/ViewOnceOpenSyncs';
import type { DeleteAttributesType } from './messageModifiers/Deletes';
import type { EditAttributesType } from './messageModifiers/Edits';
import type { MessageRequestAttributesType } from './messageModifiers/MessageRequests';
import type { ReactionAttributesType } from './messageModifiers/Reactions';
import type { ViewOnceOpenSyncAttributesType } from './messageModifiers/ViewOnceOpenSyncs';
import { ReadStatus } from './messages/MessageReadStatus';
import type { SendStateByConversationId } from './messages/MessageSendState';
import { SendStatus } from './messages/MessageSendState';
import * as Stickers from './types/Stickers';
import * as Errors from './types/errors';
import { InstallScreenStep } from './types/InstallScreen';
import { getEnvironment } from './environment';
import { SignalService as Proto } from './protobuf';
import {
  getOnDecryptionError,
  onRetryRequest,
  onInvalidPlaintextMessage,
  onSuccessfulDecrypt,
} from './util/handleRetry';
import { themeChanged } from './shims/themeChanged';
import { createIPCEvents } from './util/createIPCEvents';
import type { ServiceIdString } from './types/ServiceId';
import {
  ServiceIdKind,
  isPniString,
  isServiceIdString,
} from './types/ServiceId';
import { isAciString } from './util/isAciString';
import { normalizeAci } from './util/normalizeAci';
import * as log from './logging/log';
import { deleteAllLogs } from './util/deleteAllLogs';
import { startInteractionMode } from './services/InteractionMode';
import { ReactionSource } from './reactions/ReactionSource';
import { singleProtoJobQueue } from './jobs/singleProtoJobQueue';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from './jobs/conversationJobQueue';
import { SeenStatus } from './MessageSeenStatus';
import MessageSender from './textsecure/SendMessage';
import type AccountManager from './textsecure/AccountManager';
import { onStoryRecipientUpdate } from './util/onStoryRecipientUpdate';
import { flushAttachmentDownloadQueue } from './util/attachmentDownloadQueue';
import { initializeRedux } from './state/initializeRedux';
import { StartupQueue } from './util/StartupQueue';
import { showConfirmationDialog } from './util/showConfirmationDialog';
import { onCallEventSync } from './util/onCallEventSync';
import { sleeper } from './util/sleeper';
import { DAY, HOUR, SECOND } from './util/durations';
import { copyDataMessageIntoMessage } from './util/copyDataMessageIntoMessage';
import {
  flushMessageCounter,
  incrementMessageCounter,
  initializeMessageCounter,
} from './util/incrementMessageCounter';
import { generateMessageId } from './util/generateMessageId';
import { RetryPlaceholders } from './util/retryPlaceholders';
import { setBatchingStrategy } from './util/messageBatcher';
import { parseRemoteClientExpiration } from './util/parseRemoteClientExpiration';
import { addGlobalKeyboardShortcuts } from './services/addGlobalKeyboardShortcuts';
import { createEventHandler } from './quill/signal-clipboard/util';
import { onCallLogEventSync } from './util/onCallLogEventSync';
import { backupsService } from './services/backups';
import {
  getCallIdFromEra,
  updateLocalGroupCallHistoryTimestamp,
} from './util/callDisposition';
import { deriveStorageServiceKey, deriveMasterKey } from './Crypto';
import { AttachmentDownloadManager } from './jobs/AttachmentDownloadManager';
import { onCallLinkUpdateSync } from './util/onCallLinkUpdateSync';
import { CallMode } from './types/CallDisposition';
import type { SyncTaskType } from './util/syncTasks';
import { queueSyncTasks, runAllSyncTasks } from './util/syncTasks';
import type { ViewSyncTaskType } from './messageModifiers/ViewSyncs';
import type { ReceiptSyncTaskType } from './messageModifiers/MessageReceipts';
import type { ReadSyncTaskType } from './messageModifiers/ReadSyncs';
import { AttachmentBackupManager } from './jobs/AttachmentBackupManager';
import { getConversationIdForLogging } from './util/idForLogging';
import { encryptConversationAttachments } from './util/encryptConversationAttachments';
import { DataReader, DataWriter } from './sql/Client';
import { restoreRemoteConfigFromStorage } from './RemoteConfig';
import { getParametersForRedux, loadAll } from './services/allLoaders';
import { checkFirstEnvelope } from './util/checkFirstEnvelope';
import { BLOCKED_UUIDS_ID } from './textsecure/storage/Blocked';
import { ReleaseNotesFetcher } from './services/releaseNotesFetcher';
import {
  maybeQueueDeviceNameFetch,
  onDeviceNameChangeSync,
} from './util/onDeviceNameChangeSync';
import { postSaveUpdates } from './util/cleanup';
import { handleDataMessage } from './messages/handleDataMessage';
import { MessageModel } from './models/messages';
import { waitForEvent } from './shims/events';
import { sendSyncRequests } from './textsecure/syncRequests';

export function isOverHourIntoPast(timestamp: number): boolean {
  return isNumber(timestamp) && isOlderThan(timestamp, HOUR);
}

export async function cleanupSessionResets(): Promise<void> {
  const sessionResets = window.storage.get(
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

  StartupQueue.initialize();
  notificationService.initialize({
    i18n: window.i18n,
    storage: window.storage,
  });

  await initializeMessageCounter();

  // Initialize WebAPI as early as possible
  let server: WebAPIType | undefined;
  let messageReceiver: MessageReceiver | undefined;
  let challengeHandler: ChallengeHandler | undefined;
  let routineProfileRefresher: RoutineProfileRefresher | undefined;

  ourProfileKeyService.initialize(window.storage);

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

  const lightSessionResetQueue = new PQueue({ concurrency: 1 });
  window.Signal.Services.lightSessionResetQueue = lightSessionResetQueue;
  lightSessionResetQueue.pause();

  const onDecryptionErrorQueue = new PQueue({ concurrency: 1 });
  onDecryptionErrorQueue.pause();

  const onRetryRequestQueue = new PQueue({ concurrency: 1 });
  onRetryRequestQueue.pause();

  window.Whisper.deliveryReceiptQueue = new PQueue({
    concurrency: 1,
    timeout: durations.MINUTE * 30,
  });
  window.Whisper.deliveryReceiptQueue.pause();
  window.Whisper.deliveryReceiptBatcher = createBatcher<Receipt>({
    name: 'Whisper.deliveryReceiptBatcher',
    wait: 500,
    maxSize: 100,
    processBatch: async deliveryReceipts => {
      const groups = groupBy(deliveryReceipts, 'conversationId');
      await Promise.all(
        Object.keys(groups).map(async conversationId => {
          await conversationJobQueue.add({
            type: conversationQueueJobEnum.enum.Receipts,
            conversationId,
            receiptsType: ReceiptType.Delivery,
            receipts: groups[conversationId],
          });
        })
      );
    },
  });

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

  const { Message } = window.Signal.Types;

  log.info('background page reloaded');
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

  KeyChangeListener.init(window.textsecure.storage.protocol);
  window.textsecure.storage.protocol.on(
    'lowKeys',
    throttle(
      (ourServiceId: ServiceIdString) => {
        const serviceIdKind =
          window.textsecure.storage.user.getOurServiceIdKind(ourServiceId);
        drop(window.getAccountManager().maybeUpdateKeys(serviceIdKind));
      },
      durations.MINUTE,
      { trailing: true, leading: false }
    )
  );

  window.textsecure.storage.protocol.on('removeAllData', () => {
    window.reduxActions.stories.removeAllStories();
  });

  window.getSocketStatus = () => {
    if (server === undefined) {
      return {
        authenticated: { status: SocketStatus.CLOSED },
        unauthenticated: { status: SocketStatus.CLOSED },
      };
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
    accountManager.addEventListener('startRegistration', () => {
      pauseProcessing();
      // We should already be logged out, but this ensures that the next time we connect
      // to the auth socket it is from newly-registered credentials
      drop(server?.logout());
      authSocketConnectCount = 0;

      backupReady.reject(new Error('startRegistration'));
      backupReady = explodePromise();
      registrationCompleted = explodePromise();
    });

    accountManager.addEventListener('endRegistration', () => {
      window.Whisper.events.trigger('userChanged', false);

      drop(window.storage.put('postRegistrationSyncsStatus', 'incomplete'));
      registrationCompleted?.resolve();
      drop(Registration.markDone());
    });
    return accountManager;
  };

  const cancelInitializationMessage = setAppLoadingScreenMessage(
    undefined,
    window.i18n
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
              cancelText: window.i18n('icu:quit'),
              confirmStyle: 'negative',
              title: window.i18n('icu:deleteOldIndexedDBData'),
              okText: window.i18n('icu:deleteOldData'),
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
      // We need to use direct data calls, since window.storage isn't ready yet.
      await DataWriter.createOrUpdateItem({
        id: 'indexeddb-delete-needed',
        value: true,
      });
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

    restoreRemoteConfigFromStorage();

    window.Whisper.events.on('firstEnvelope', checkFirstEnvelope);
    server = window.WebAPI.connect({
      ...window.textsecure.storage.user.getWebAPICredentials(),
      hasStoriesDisabled: window.storage.get('hasStoriesDisabled', false),
    });

    window.textsecure.server = server;
    window.textsecure.messaging = new window.textsecure.MessageSender(server);

    challengeHandler = new ChallengeHandler({
      storage: window.storage,

      startQueue(conversationId: string) {
        conversationJobQueue.resolveVerificationWaiter(conversationId);
      },

      requestChallenge(request) {
        if (window.SignalCI) {
          window.SignalCI.handleEvent('challenge', request);
          return;
        }
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
        window.reduxActions.toast.showToast({
          toastType: ToastType.CaptchaFailed,
        });
      },

      onChallengeSolved() {
        window.reduxActions.toast.showToast({
          toastType: ToastType.CaptchaSolved,
        });
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
      storage: window.storage,
      serverTrustRoot: window.getServerTrustRoot(),
    });

    function queuedEventListener<E extends Event>(
      handler: (event: E) => Promise<void> | void,
      track = true
    ): (event: E) => void {
      return (event: E): void => {
        drop(
          eventHandlerQueue.add(
            createTaskWithTimeout(async () => {
              try {
                await handler(event);
              } finally {
                // message/sent: Message.handleDataMessage has its own queue and will
                //   trigger this event itself when complete.
                // error: Error processing (below) also has its own queue and
                // self-trigger.
                if (track) {
                  window.Whisper.events.trigger('incrementProgress');
                }
              }
            }, `queuedEventListener(${event.type}, ${event.timeStamp})`)
          )
        );
      };
    }

    messageReceiver.addEventListener(
      'envelopeUnsealed',
      queuedEventListener(onEnvelopeUnsealed, false)
    );
    messageReceiver.addEventListener(
      'envelopeQueued',
      queuedEventListener(onEnvelopeQueued, false)
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
      'contactSync',
      queuedEventListener(onContactSync)
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
      queuedEventListener(onStoryRecipientUpdate, false)
    );
    messageReceiver.addEventListener(
      'callEventSync',
      queuedEventListener(onCallEventSync, false)
    );
    messageReceiver.addEventListener(
      'callLinkUpdateSync',
      queuedEventListener(onCallLinkUpdateSync, false)
    );
    messageReceiver.addEventListener(
      'callLogEventSync',
      queuedEventListener(onCallLogEventSync, false)
    );
    messageReceiver.addEventListener(
      'deleteForMeSync',
      queuedEventListener(onDeleteForMeSync, false)
    );
    messageReceiver.addEventListener(
      'deviceNameChangeSync',
      queuedEventListener(onDeviceNameChangeSync, false)
    );

    if (!window.storage.get('defaultConversationColor')) {
      drop(
        window.storage.put(
          'defaultConversationColor',
          DEFAULT_CONVERSATION_COLOR
        )
      );
    }

    senderCertificateService.initialize({
      server,
      events: window.Whisper.events,
      storage: window.storage,
    });

    areWeASubscriberService.update(window.storage, server);

    void cleanupSessionResets();

    // These make key operations available to IPC handlers created in preload.js
    window.Events = createIPCEvents({
      shutdown: async () => {
        log.info('background/shutdown');

        flushMessageCounter();

        // Hangup active calls
        window.Signal.Services.calling.hangupAllCalls(
          'background/shutdown: shutdown requested'
        );

        const attachmentDownloadStopPromise = AttachmentDownloadManager.stop();
        const attachmentBackupStopPromise = AttachmentBackupManager.stop();

        server?.cancelInflightRequests('shutdown');

        // Stop background processing
        idleDetector.stop();

        // Stop processing incoming messages
        if (messageReceiver) {
          strictAssert(
            server !== undefined,
            'WebAPI should be initialized together with MessageReceiver'
          );
          log.info('background/shutdown: shutting down messageReceiver');
          pauseProcessing();
          await window.waitForAllBatchers();
        }

        log.info('background/shutdown: flushing conversations');

        // Flush debounced updates for conversations
        await Promise.all(
          window.ConversationController.getAll().map(convo =>
            convo.flushDebouncedUpdates()
          )
        );

        sleeper.shutdown();

        const shutdownQueues = async () => {
          log.info('background/shutdown: shutting down queues');
          await Promise.allSettled([
            StartupQueue.shutdown(),
            shutdownAllJobQueues(),
          ]);

          log.info('background/shutdown: shutting down conversation queues');
          await Promise.allSettled(
            window.ConversationController.getAll().map(async convo => {
              try {
                await convo.shutdownJobQueue();
              } catch (err) {
                log.error(
                  `background/shutdown: error waiting for conversation ${convo.idForLogging} job queue shutdown`,
                  Errors.toLogFormat(err)
                );
              }
            })
          );

          log.info('background/shutdown: all queues shutdown');
        };

        // wait for at most 1 minutes for startup queue and job queues to drain
        let timeout: NodeJS.Timeout | undefined;
        await Promise.race([
          shutdownQueues(),
          new Promise<void>((resolve, _) => {
            timeout = setTimeout(() => {
              log.warn(
                'background/shutdown - timed out waiting for StartupQueue/JobQueues, continuing with shutdown'
              );
              timeout = undefined;
              resolve();
            }, 10 * SECOND);
          }),
        ]);
        if (timeout) {
          clearTimeout(timeout);
        }

        log.info('background/shutdown: waiting for all batchers');

        // A number of still-to-queue database queries might be waiting inside batchers.
        //   We wait for these to empty first, and then shut down the data interface.
        await Promise.all([
          window.waitForAllBatchers(),
          window.waitForAllWaitBatchers(),
        ]);

        log.info(
          'background/shutdown: waiting for all attachment backups & downloads to finish'
        );
        // Since we canceled the inflight requests earlier in shutdown, these should
        // resolve quickly
        await attachmentDownloadStopPromise;
        await attachmentBackupStopPromise;

        log.info('background/shutdown: closing the database');

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
        await window.storage.remove('remoteBuildExpiration');
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
          window.storage.put('showStickersIntroduction', true),
          window.storage.put('showStickerPickerHint', true),
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

        await DataWriter.clearAllErrorStickerPackAttempts();
      }

      if (window.isBeforeVersion(lastVersion, 'v5.51.0-beta.2')) {
        await window.storage.put('groupCredentials', []);
        await DataWriter.removeAllProfileKeyCredentials();
      }

      if (window.isBeforeVersion(lastVersion, 'v6.38.0-beta.1')) {
        await window.storage.remove('hasCompletedSafetyNumberOnboarding');
      }

      // This one should always be last - it could restart the app
      if (window.isBeforeVersion(lastVersion, 'v5.30.0-alpha')) {
        await deleteAllLogs();
        window.SignalContext.restartApp();
        return;
      }

      if (window.isBeforeVersion(lastVersion, 'v7.3.0-beta.1')) {
        await window.storage.remove('lastHeartbeat');
        await window.storage.remove('lastStartup');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.8.0-beta.1')) {
        await window.storage.remove('sendEditWarningShown');
        await window.storage.remove('formattingWarningShown');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.21.0-beta.1')) {
        await window.storage.remove(
          'hasRegisterSupportForUnauthenticatedDelivery'
        );
      }

      if (window.isBeforeVersion(lastVersion, 'v7.33.0-beta.1')) {
        await window.storage.remove('masterKeyLastRequestTime');
      }

      if (window.isBeforeVersion(lastVersion, 'v7.43.0-beta.1')) {
        await window.storage.remove('primarySendsSms');
      }
    }

    setAppLoadingScreenMessage(
      window.i18n('icu:optimizingApplication'),
      window.i18n
    );

    if (newVersion || window.storage.get('needOrphanedAttachmentCheck')) {
      await window.storage.remove('needOrphanedAttachmentCheck');
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

    setAppLoadingScreenMessage(window.i18n('icu:loading'), window.i18n);

    let isMigrationWithIndexComplete = false;
    let isIdleTaskProcessing = false;
    log.info(
      `Starting background data migration. Target version: ${Message.CURRENT_SCHEMA_VERSION}`
    );
    idleDetector.on('idle', async () => {
      const NUM_MESSAGES_PER_BATCH = 1000;
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

    const retryPlaceholders = new RetryPlaceholders({
      retryReceiptLifespan: HOUR,
    });
    window.Signal.Services.retryPlaceholders = retryPlaceholders;

    setInterval(async () => {
      const now = Date.now();
      let sentProtoMaxAge = 14 * DAY;

      try {
        sentProtoMaxAge = parseIntOrThrow(
          window.Signal.RemoteConfig.getValue('desktop.retryRespondMaxAge'),
          'retryRespondMaxAge'
        );
      } catch (error) {
        log.warn(
          'background/setInterval: Failed to parse integer from desktop.retryRespondMaxAge feature flag',
          Errors.toLogFormat(error)
        );
      }

      try {
        await DataWriter.deleteSentProtosOlderThan(now - sentProtoMaxAge);
      } catch (error) {
        log.error(
          'background/onready/setInterval: Error deleting sent protos: ',
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
          'background/onready/setInterval: Error getting expired retry placeholders: ',
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
        window.textsecure.storage.protocol.hydrateCaches(),
        loadAll(),
      ]);
      await window.ConversationController.checkForConflicts();
    } catch (error) {
      log.error(
        'background.js: ConversationController failed to load:',
        Errors.toLogFormat(error)
      );
    } finally {
      setupAppState();
      drop(start());
      window.Signal.Services.initializeNetworkObserver(
        window.reduxActions.network,
        () => window.getSocketStatus().authenticated.status
      );
      window.Signal.Services.initializeUpdateListener(
        window.reduxActions.updates
      );
      window.Signal.Services.calling.initialize(
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
  // end of window.storage.onready() callback

  log.info('Storage fetch');
  drop(window.storage.fetch());

  function pauseProcessing() {
    strictAssert(server != null, 'WebAPI not initialized');
    strictAssert(
      messageReceiver != null,
      'messageReceiver must be initialized'
    );

    StorageService.disableStorageService();
    server.unregisterRequestHandler(messageReceiver);
    messageReceiver.stopProcessing();
  }

  function setupAppState() {
    initializeRedux(getParametersForRedux());

    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();

    const {
      conversationsUpdated,
      conversationRemoved,
      removeAllConversations,
      onConversationClosed,
    } = window.reduxActions.conversations;

    // Conversation add/update/remove actions are batched in this batcher to ensure
    // that we retain correct orderings
    const convoUpdateBatcher = createBatcher<
      | { type: 'change' | 'add'; conversation: ConversationModel }
      | { type: 'remove'; id: string }
    >({
      name: 'changedConvoBatcher',
      processBatch(batch) {
        let changedOrAddedBatch = new Array<ConversationModel>();
        function flushChangedOrAddedBatch() {
          if (!changedOrAddedBatch.length) {
            return;
          }
          conversationsUpdated(
            changedOrAddedBatch.map(conversation => conversation.format())
          );
          changedOrAddedBatch = [];
        }

        batchDispatch(() => {
          for (const item of batch) {
            if (item.type === 'add' || item.type === 'change') {
              changedOrAddedBatch.push(item.conversation);
            } else {
              strictAssert(item.type === 'remove', 'must be remove');

              flushChangedOrAddedBatch();

              onConversationClosed(item.id, 'removed');
              conversationRemoved(item.id);
            }
          }
          flushChangedOrAddedBatch();
        });
      },

      wait: () => {
        if (backupsService.isImportRunning()) {
          return 500;
        }

        if (messageReceiver && !messageReceiver.hasEmptied()) {
          return 250;
        }

        // This delay ensures that the .format() call isn't synchronous as a
        //   Backbone property is changed. Important because our _byUuid/_byE164
        //   lookups aren't up-to-date as the change happens; just a little bit
        //   after.
        return 1;
      },
      maxSize: Infinity,
    });

    convoCollection.on('add', (conversation: ConversationModel | undefined) => {
      if (!conversation) {
        return;
      }
      if (
        backupsService.isImportRunning() ||
        !window.reduxStore.getState().app.hasInitialLoadCompleted
      ) {
        convoUpdateBatcher.add({ type: 'add', conversation });
      } else {
        // During normal app usage, we require conversations to be added synchronously
        conversationsUpdated([conversation.format()]);
      }
    });

    convoCollection.on('remove', conversation => {
      const { id } = conversation || {};

      convoUpdateBatcher.add({ type: 'remove', id });
    });

    convoCollection.on(
      'props-change',
      (conversation: ConversationModel | undefined, isBatched?: boolean) => {
        if (!conversation) {
          return;
        }

        // `isBatched` is true when the `.set()` call on the conversation model already
        // runs from within `react-redux`'s batch. Instead of batching the redux update
        // for later, update immediately. To ensure correct update ordering, only do this
        // optimization if there are no other pending conversation updates
        if (isBatched && !convoUpdateBatcher.anyPending()) {
          conversationsUpdated([conversation.format()]);
          return;
        }

        convoUpdateBatcher.add({ type: 'change', conversation });
      }
    );

    // Called by SignalProtocolStore#removeAllData()
    convoCollection.on('reset', removeAllConversations);

    window.Whisper.events.on('userChanged', (reconnect = false) => {
      const newDeviceId = window.textsecure.storage.user.getDeviceId();
      const newNumber = window.textsecure.storage.user.getNumber();
      const newACI = window.textsecure.storage.user.getAci();
      const newPNI = window.textsecure.storage.user.getPni();
      const ourConversation =
        window.ConversationController.getOurConversation();

      if (ourConversation?.get('e164') !== newNumber) {
        ourConversation?.set('e164', newNumber);
      }

      window.reduxActions.user.userChanged({
        ourConversationId: ourConversation?.get('id'),
        ourDeviceId: newDeviceId,
        ourNumber: newNumber,
        ourAci: newACI,
        ourPni: newPNI,
        regionCode: window.storage.get('regionCode'),
      });

      if (reconnect) {
        log.info('background: reconnecting websocket on user change');
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

  window.Whisper.events.on('powerMonitorSuspend', () => {
    log.info('powerMonitor: suspend');
    server?.cancelInflightRequests('powerMonitorSuspend');
    suspendTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorResume', () => {
    log.info('powerMonitor: resume');
    server?.checkSockets();
    server?.cancelInflightRequests('powerMonitorResume');
    resumeTasksWithTimeout();
  });

  window.Whisper.events.on('powerMonitorLockScreen', () => {
    window.reduxActions.calling.hangUpActiveCall('powerMonitorLockScreen');
  });

  const reconnectToWebSocketQueue = new LatestQueue();

  const enqueueReconnectToWebSocket = () => {
    reconnectToWebSocketQueue.add(async () => {
      if (!server) {
        log.info('reconnectToWebSocket: No server. Early return.');
        return;
      }

      if (remotelyExpired) {
        return;
      }

      log.info('reconnectToWebSocket starting...');
      await server.reconnect();
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

    log.error('background: remote expiration detected, disabling reconnects');
    drop(window.storage.put('remoteBuildExpiration', Date.now()));
    drop(server?.onRemoteExpiration());
    remotelyExpired = true;
  });

  async function runStorageService({ reason }: { reason: string }) {
    await backupReady.promise;

    StorageService.enableStorageService();
    StorageService.runStorageServiceSyncJob({
      reason: `runStorageService/${reason}`,
    });
  }

  async function start() {
    // Storage is ready because `start()` is called from `storage.onready()`

    strictAssert(server !== undefined, 'start: server not initialized');
    initializeAllJobQueues({
      server,
    });

    strictAssert(challengeHandler, 'start: challengeHandler');
    await challengeHandler.load();

    if (!window.storage.user.getNumber()) {
      const ourConversation =
        window.ConversationController.getOurConversation();
      const ourE164 = ourConversation?.get('e164');
      if (ourE164) {
        log.warn('Restoring E164 from our conversation');
        await window.storage.user.setNumber(ourE164);
      }
    }

    if (newVersion && lastVersion) {
      if (window.isBeforeVersion(lastVersion, 'v5.31.0')) {
        window.ConversationController.repairPinnedConversations();
      }
    }

    void badgeImageFileDownloader.checkForFilesToDownload();

    initializeExpiringMessageService();

    log.info('Blocked uuids cleanup: starting...');
    const blockedUuids = window.storage.get(BLOCKED_UUIDS_ID, []);
    const blockedAcis = blockedUuids.filter(isAciString);
    const diff = blockedUuids.length - blockedAcis.length;
    if (diff > 0) {
      log.warn(
        `Blocked uuids cleanup: Found ${diff} non-ACIs in blocked list. Removing.`
      );
      await window.storage.put(BLOCKED_UUIDS_ID, blockedAcis);
    }
    log.info('Blocked uuids cleanup: complete');

    log.info('Expiration start timestamp cleanup: starting...');
    const messagesUnexpectedlyMissingExpirationStartTimestamp =
      await DataReader.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
    log.info(
      `Expiration start timestamp cleanup: Found ${messagesUnexpectedlyMissingExpirationStartTimestamp.length} messages for cleanup`
    );
    if (!window.textsecure.storage.user.getAci()) {
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

      await DataWriter.saveMessages(newMessageAttributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
        postSaveUpdates,
      });
    }
    log.info('Expiration start timestamp cleanup: complete');

    await runAllSyncTasks();

    cancelInitializationMessage();
    render(
      window.Signal.State.Roots.createApp(window.reduxStore),
      document.getElementById('app-container')
    );
    const hideMenuBar = window.storage.get('hide-menu-bar', false);
    window.IPC.setAutoHideMenuBar(hideMenuBar);
    window.IPC.setMenuBarVisibility(!hideMenuBar);

    startTimeTravelDetector(() => {
      window.Whisper.events.trigger('timetravel');
    });

    void updateExpiringMessagesService();
    tapToViewMessagesDeletionService.update();
    window.Whisper.events.on('timetravel', () => {
      void updateExpiringMessagesService();
      tapToViewMessagesDeletionService.update();
    });

    const isCoreDataValid = Boolean(
      window.textsecure.storage.user.getAci() &&
        window.ConversationController.getOurConversation()
    );

    if (isCoreDataValid && Registration.everDone()) {
      idleDetector.start();
      if (window.storage.get('backupDownloadPath')) {
        window.reduxActions.installer.showBackupImport();
      } else {
        window.reduxActions.app.openInbox();
      }
    } else {
      window.IPC.readyForUpdates();
      window.reduxActions.installer.startInstaller();
    }

    const { activeWindowService } = window.SignalContext;

    activeWindowService.registerForActive(() => notificationService.clear());
    window.addEventListener('unload', () => notificationService.fastClear());

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
        const remoteBuildExpirationTimestamp = parseRemoteClientExpiration(
          value as string
        );
        if (remoteBuildExpirationTimestamp) {
          drop(
            window.storage.put(
              'remoteBuildExpiration',
              remoteBuildExpirationTimestamp
            )
          );
        }
      }
    );

    if (resolveOnAppView) {
      resolveOnAppView();
      resolveOnAppView = undefined;
    }

    setupNetworkChangeListeners();
  }

  function setupNetworkChangeListeners() {
    strictAssert(server, 'server must be initialized');

    const onOnline = () => {
      log.info('background: online');
      drop(afterAuthSocketConnect());
    };

    window.Whisper.events.on('online', onOnline);

    const onOffline = () => {
      const { hasInitialLoadCompleted, appView } =
        window.reduxStore.getState().app;

      const hasAppEverBeenRegistered = Registration.everDone();

      log.info('background: offline', {
        authSocketConnectCount,
        hasInitialLoadCompleted,
        appView,
        hasAppEverBeenRegistered,
      });

      drop(challengeHandler?.onOffline());
      drop(AttachmentDownloadManager.stop());
      drop(AttachmentBackupManager.stop());

      if (messageReceiver) {
        drop(messageReceiver.drain());
        server?.unregisterRequestHandler(messageReceiver);
      }

      if (hasAppEverBeenRegistered) {
        const state = window.reduxStore.getState();
        if (state.app.appView === AppViewType.Installer) {
          if (state.installer.step === InstallScreenStep.LinkInProgress) {
            log.info(
              'background: offline, but app has been registered before; opening inbox'
            );
            window.reduxActions.app.openInbox();
          } else if (state.installer.step === InstallScreenStep.BackupImport) {
            log.warn('background: offline, but app has needs to import backup');
            // TODO: DESKTOP-7584
          }
        }

        if (!hasInitialLoadCompleted) {
          log.info(
            'background: offline; initial load not completed; triggering onEmpty'
          );
          drop(onEmpty({ isFromMessageReceiver: false })); // this ensures that the inbox loading progress bar is dismissed
        }
      }
    };
    window.Whisper.events.on('offline', onOffline);

    // Because these events may have already fired, we manually call their handlers.
    // isOnline() will return undefined if neither of these events have been emitted.
    if (server.isOnline() === true) {
      onOnline();
    } else if (server.isOnline() === false) {
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
      return;
    }

    strictAssert(server, 'server must be initialized');
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

      if (!window.textsecure.storage.user.getAci()) {
        log.error(`${logId}: ACI not captured during registration, unlinking`);
        return unlinkAndDisconnect();
      }

      if (!window.textsecure.storage.user.getPni()) {
        log.error(`${logId}: PNI not captured during registration, unlinking`);
        return unlinkAndDisconnect();
      }

      // 2. Fetch remote config, before we process the message queue
      if (isFirstAuthSocketConnect) {
        try {
          await window.Signal.RemoteConfig.forceRefreshRemoteConfig(
            server,
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
        window.storage.get('postRegistrationSyncsStatus') !== 'incomplete';

      // 3. Send any critical sync requests after registration
      if (!postRegistrationSyncsComplete) {
        log.info(`${logId}: postRegistrationSyncs not complete, sending sync`);

        setIsInitialContactSync(true);
        const syncRequest = await sendSyncRequests();
        hasSentSyncRequests = true;
        contactSyncComplete = syncRequest.contactSyncComplete;
      }

      // 4. Download (or resume download) of link & sync backup
      const { wasBackupImported } = await maybeDownloadAndImportBackup();
      log.info(logId, {
        wasBackupImported,
      });

      // 5. Kickoff storage service sync
      if (isFirstAuthSocketConnect || !postRegistrationSyncsComplete) {
        log.info(`${logId}: triggering storage service sync`);

        storageServiceSyncComplete = waitForEvent(
          'storageService:syncComplete'
        );
        drop(runStorageService({ reason: 'afterFirstAuthSocketConnect' }));
      }

      // 6. Start processing messages from websocket
      log.info(`${logId}: enabling message processing`);
      server.registerRequestHandler(messageReceiver);
      messageReceiver.startProcessingQueue();

      // 7. Wait for critical post-registration syncs before showing inbox
      if (!postRegistrationSyncsComplete) {
        const syncsToAwaitBeforeShowingInbox = [contactSyncComplete];

        // If backup was imported, we do not need to await the storage service sync
        if (!wasBackupImported) {
          syncsToAwaitBeforeShowingInbox.push(storageServiceSyncComplete);
        }

        try {
          await Promise.all(syncsToAwaitBeforeShowingInbox);
          await window.storage.put('postRegistrationSyncsStatus', 'complete');
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
    const backupDownloadPath = window.storage.get('backupDownloadPath');
    if (backupDownloadPath) {
      tapToViewMessagesDeletionService.pause();

      // Download backup before enabling request handler and storage service
      try {
        const { wasBackupImported } = await backupsService.downloadAndImport({
          onProgress: (backupStep, currentBytes, totalBytes) => {
            window.reduxActions.installer.updateBackupImportProgress({
              backupStep,
              currentBytes,
              totalBytes,
            });
          },
        });

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

      const manager = window.getAccountManager();
      await Promise.all([
        manager.maybeUpdateDeviceName(),
        window.textsecure.storage.user.removeSignalingKey(),
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
      window.storage.get('accountEntropyPool') ||
      window.ConversationController.areWePrimaryDevice()
    ) {
      return;
    }

    const lastSent =
      window.storage.get('accountEntropyPoolLastRequestTime') ?? 0;
    const now = Date.now();

    // If we last attempted sync one day in the past, or if we time
    // traveled.
    if (isOlderThan(lastSent, DAY) || lastSent > now) {
      log.warn('ensureAEP: AEP not captured, requesting sync');
      await singleProtoJobQueue.add(MessageSender.getRequestKeySyncMessage());
      await window.storage.put('accountEntropyPoolLastRequestTime', now);
    } else {
      log.warn(
        'ensureAEP: AEP not captured, but sync requested recently.' +
          'Not running'
      );
    }
  }

  async function registerCapabilities() {
    strictAssert(server, 'server must be initialized');

    try {
      await server.registerCapabilities({
        deleteSync: true,
        versionedExpirationTimer: true,
        ssre2: true,
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

    strictAssert(challengeHandler, 'afterEveryAuthConnect: challengeHandler');
    drop(challengeHandler.onOnline());
    reconnectBackOff.reset();
    drop(window.Signal.Services.initializeGroupCredentialFetcher());
    drop(AttachmentDownloadManager.start());

    if (isBackupEnabled()) {
      backupsService.start();
      drop(AttachmentBackupManager.start());
    }
  }

  function onNavigatorOffline() {
    log.info('background: navigator offline');

    drop(server?.onNavigatorOffline());
  }

  function onNavigatorOnline() {
    log.info('background: navigator online');
    drop(server?.onNavigatorOnline());
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
    window.Whisper.deliveryReceiptQueue.pause();
    notificationService.disable();
  }

  // 2. After the socket finishes processing any queued messages, restart these queues
  function restartQueuesAndNotificationsOnEmpty() {
    log.info('restartQueuesAndNotificationsOnEmpty: restarting');
    profileKeyResponseQueue.start();
    lightSessionResetQueue.start();
    onDecryptionErrorQueue.start();
    onRetryRequestQueue.start();
    window.Whisper.deliveryReceiptQueue.start();
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

  async function onEmpty({
    isFromMessageReceiver,
  }: { isFromMessageReceiver?: boolean } = {}): Promise<void> {
    const { storage } = window.textsecure;

    await Promise.all([
      window.waitForAllBatchers(),
      window.flushAllWaitBatchers(),
    ]);
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
        storage,
      });

      void routineProfileRefresher.start();
    }

    drop(usernameIntegrity.start());

    drop(ReleaseNotesFetcher.init(window.Whisper.events, newVersion));

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

    await window.storage.put('read-receipt-setting', Boolean(readReceipts));

    if (
      unidentifiedDeliveryIndicators === true ||
      unidentifiedDeliveryIndicators === false
    ) {
      await window.storage.put(
        'unidentifiedDeliveryIndicators',
        unidentifiedDeliveryIndicators
      );
    }

    if (typingIndicators === true || typingIndicators === false) {
      await window.storage.put('typingIndicators', typingIndicators);
    }

    if (linkPreviews === true || linkPreviews === false) {
      await window.storage.put('linkPreviews', linkPreviews);
    }
  }

  function onTyping(ev: TypingEvent): void {
    // Note: this type of message is automatically removed from cache in MessageReceiver

    const { typing, sender, senderAci, senderDevice } = ev;
    const { groupV2Id, started } = typing || {};

    // We don't do anything with incoming typing messages if the setting is disabled
    if (!window.storage.get('typingIndicators')) {
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

    const ourAci = window.textsecure.storage.user.getAci();
    const ourPni = window.textsecure.storage.user.getPni();

    // We drop typing notifications in groups we're not a part of
    if (
      !isDirectConversation(conversation.attributes) &&
      !(ourAci && conversation.hasMember(ourAci)) &&
      !(ourPni && conversation.hasMember(ourPni))
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

    const ourAci = window.textsecure.storage.user.getAci();
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

      const serviceIdKind = window.textsecure.storage.user.getOurServiceIdKind(
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
      source: window.textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sourceServiceId: window.textsecure.storage.user.getAci(),
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
      type: Message.PRIVATE,
      id: conversation.id,
    };
  };

  // Note: We do very little in this function, since everything in handleDataMessage is
  //   inside a conversation-specific queue(). Any code here might run before an earlier
  //   message is processed in handleDataMessage().
  async function onSentMessage(event: SentEvent): Promise<void> {
    const { data, confirm } = event;

    const source = window.textsecure.storage.user.getNumber();
    const sourceServiceId = window.textsecure.storage.user.getAci();
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
        fromDevice: window.storage.user.getDeviceId() ?? 1,
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
      if (message.groupV2 && messageDescriptor.type === Message.GROUP) {
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
    window.Whisper.events.trigger('unauthorized');

    log.warn(
      'unlinkAndDisconnect: Client is no longer authorized; ' +
        'deleting local configuration'
    );

    if (messageReceiver) {
      log.info('unlinkAndDisconnect: logging out');
      strictAssert(server !== undefined, 'WebAPI not initialized');

      pauseProcessing();

      backupReady.reject(new Error('Aborted'));
      backupReady = explodePromise();

      await server.logout();
      await window.waitForAllBatchers();
    }

    void onEmpty({ isFromMessageReceiver: false });

    void Registration.remove();

    const NUMBER_ID_KEY = 'number_id';
    const UUID_ID_KEY = 'uuid_id';
    const PNI_KEY = 'pni';
    const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
    const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

    const previousNumberId = window.textsecure.storage.get(NUMBER_ID_KEY);
    const previousUuidId = window.textsecure.storage.get(UUID_ID_KEY);
    const previousPni = window.textsecure.storage.get(PNI_KEY);
    const lastProcessedIndex = window.textsecure.storage.get(
      LAST_PROCESSED_INDEX_KEY
    );
    const isMigrationComplete = window.textsecure.storage.get(
      IS_MIGRATION_COMPLETE_KEY
    );

    try {
      log.info('unlinkAndDisconnect: removing configuration');

      // We use username for integrity check
      const ourConversation =
        window.ConversationController.getOurConversation();
      if (ourConversation) {
        ourConversation.unset('username');
        await DataWriter.updateConversation(ourConversation.attributes);
      }

      // Then make sure outstanding conversation saves are flushed
      await DataWriter.flushUpdateConversationBatcher();

      // Then make sure that all previously-outstanding database saves are flushed
      await DataReader.getItemById('manifestVersion');

      // Finally, conversations in the database, and delete all config tables
      await window.textsecure.storage.protocol.removeAllConfiguration();

      // These three bits of data are important to ensure that the app loads up
      //   the conversation list, instead of showing just the QR code screen.
      if (previousNumberId !== undefined) {
        await window.textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);
      }
      if (previousUuidId !== undefined) {
        await window.textsecure.storage.put(UUID_ID_KEY, previousUuidId);
      }
      if (previousPni !== undefined) {
        await window.textsecure.storage.put(PNI_KEY, previousPni);
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

      // Re-hydrate items from memory; removeAllConfiguration above changed database
      await window.storage.fetch();

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
    log.error('background onError:', Errors.toLogFormat(error));

    if (
      error instanceof HTTPError &&
      (error.code === 401 || error.code === 403)
    ) {
      void unlinkAndDisconnect();
      return;
    }

    log.warn('background onError: Doing nothing with incoming error');
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
        const ourAci = window.textsecure.storage.user.getAci() ?? null;
        const ourE164 = window.textsecure.storage.user.getNumber() ?? null;
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
        strictAssert(server, 'WebAPI not ready');
        areWeASubscriberService.update(window.storage, server);
        break;
      default:
        log.info(`onFetchLatestSync: Unknown type encountered ${eventType}`);
    }

    ev.confirm();
  }

  async function onKeysSync(ev: KeysEvent) {
    ev.confirm();

    const { accountEntropyPool, masterKey, mediaRootBackupKey } = ev;

    const prevMasterKeyBase64 = window.storage.get('masterKey');
    const prevMasterKey = prevMasterKeyBase64
      ? Bytes.fromBase64(prevMasterKeyBase64)
      : undefined;
    const prevAccountEntropyPool = window.storage.get('accountEntropyPool');

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
      await window.storage.remove('accountEntropyPool');
    } else {
      if (prevAccountEntropyPool !== accountEntropyPool) {
        log.info('onKeysSync: updating accountEntropyPool');
      }
      await window.storage.put('accountEntropyPool', accountEntropyPool);
    }

    if (derivedMasterKey == null) {
      if (prevMasterKey != null) {
        log.warn('onKeysSync: deleting window.masterKey');
      }
      await window.storage.remove('masterKey');
    } else {
      if (!Bytes.areEqual(derivedMasterKey, prevMasterKey)) {
        log.info('onKeysSync: updating masterKey');
      }
      // Override provided storageServiceKey because it is deprecated.
      await window.storage.put('masterKey', Bytes.toBase64(derivedMasterKey));
    }

    const prevMediaRootBackupKey = window.storage.get('backupMediaRootKey');
    if (mediaRootBackupKey == null) {
      if (prevMediaRootBackupKey != null) {
        log.warn('onKeysSync: deleting window.backupMediaRootKey');
      }
      await window.storage.remove('backupMediaRootKey');
    } else {
      if (!Bytes.areEqual(prevMediaRootBackupKey, mediaRootBackupKey)) {
        log.info('onKeysSync: updating window.backupMediaRootKey');
      }
      await window.storage.put('backupMediaRootKey', mediaRootBackupKey);
    }

    if (derivedMasterKey != null) {
      const storageServiceKey = deriveStorageServiceKey(derivedMasterKey);
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
        try {
          await window.storage.put('storageKey', storageServiceKeyBase64);
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
  }

  function onMessageRequestResponse(ev: MessageRequestResponseEvent): void {
    const { threadAci, groupV2Id, messageRequestResponseType } = ev;

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
    drop(window.storage.put('localDeleteWarningShown', true));

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
}

window.startApp = startApp;
