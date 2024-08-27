// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, throttle, groupBy } from 'lodash';
import { render } from 'react-dom';
import { batch as batchDispatch } from 'react-redux';
import PQueue from 'p-queue';
import pMap from 'p-map';
import { v4 as generateUuid } from 'uuid';

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
import { migrateMessageData } from './messages/migrateMessageData';
import { createBatcher } from './util/batcher';
import {
  initializeAllJobQueues,
  shutdownAllJobQueues,
} from './jobs/initializeAllJobQueues';
import { removeStorageKeyJobQueue } from './jobs/removeStorageKeyJobQueue';
import { ourProfileKeyService } from './services/ourProfileKey';
import { notificationService } from './services/notifications';
import { areWeASubscriberService } from './services/areWeASubscriber';
import { onContactSync, setIsInitialSync } from './services/contactSync';
import { startTimeTravelDetector } from './util/startTimeTravelDetector';
import { shouldRespondWithProfileKey } from './util/shouldRespondWithProfileKey';
import { LatestQueue } from './util/LatestQueue';
import { parseIntOrThrow } from './util/parseIntOrThrow';
import { getProfile } from './util/getProfile';
import type {
  ConfigurationEvent,
  DecryptionErrorEvent,
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
import { SignalService as Proto } from './protobuf';
import {
  onRetryRequest,
  onDecryptionError,
  onInvalidPlaintextMessage,
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
import { deriveStorageServiceKey } from './Crypto';
import { AttachmentDownloadManager } from './jobs/AttachmentDownloadManager';
import { onCallLinkUpdateSync } from './util/onCallLinkUpdateSync';
import { CallMode } from './types/CallDisposition';
import type { SyncTaskType } from './util/syncTasks';
import { queueSyncTasks } from './util/syncTasks';
import type { ViewSyncTaskType } from './messageModifiers/ViewSyncs';
import type { ReceiptSyncTaskType } from './messageModifiers/MessageReceipts';
import type { ReadSyncTaskType } from './messageModifiers/ReadSyncs';
import { AttachmentBackupManager } from './jobs/AttachmentBackupManager';
import { getConversationIdForLogging } from './util/idForLogging';
import { encryptConversationAttachments } from './util/encryptConversationAttachments';
import { DataReader, DataWriter } from './sql/Client';
import { restoreRemoteConfigFromStorage } from './RemoteConfig';
import { getParametersForRedux, loadAll } from './services/allLoaders';

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
  const { upgradeMessageSchema } = window.Signal.Migrations;

  log.info('background page reloaded');
  log.info('environment:', window.getEnvironment());

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

      drop(Registration.markDone());
      log.info('dispatching registration event');
      window.Whisper.events.trigger('registration_done');
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
      server,
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
      'decryption-error',
      queuedEventListener((event: DecryptionErrorEvent): void => {
        drop(onDecryptionErrorQueue.add(() => onDecryptionError(event)));
      })
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
          const batchWithIndex = await migrateMessageData({
            numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
            upgradeMessageSchema,
            getMessagesNeedingUpgrade: DataReader.getMessagesNeedingUpgrade,
            saveMessages: DataWriter.saveMessages,
            incrementMessagesMigrationAttempts:
              DataWriter.incrementMessagesMigrationAttempts,
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

    void window.Signal.RemoteConfig.initRemoteConfig(server);

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
        window.reduxActions.network
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

  function setupAppState() {
    initializeRedux(getParametersForRedux());

    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();

    const {
      conversationAdded,
      conversationChanged,
      conversationRemoved,
      removeAllConversations,
      onConversationClosed,
    } = window.reduxActions.conversations;

    convoCollection.on('remove', conversation => {
      const { id } = conversation || {};

      onConversationClosed(id, 'removed');
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
    window.reduxActions.app.openInstaller();
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

    log.warn('background: remote expiration detected, disabling reconnects');
    drop(server?.onRemoteExpiration());
    remotelyExpired = true;
  });

  async function runStorageService() {
    if (window.storage.get('backupDownloadPath')) {
      log.info(
        'background: not running storage service while downloading backup'
      );
      return;
    }
    StorageService.enableStorageService();
    StorageService.runStorageServiceSyncJob();
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

    window.dispatchEvent(new Event('storage_ready'));

    void badgeImageFileDownloader.checkForFilesToDownload();

    initializeExpiringMessageService(singleProtoJobQueue);

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
      });
    }
    log.info('Expiration start timestamp cleanup: complete');

    {
      log.info('Startup/syncTasks: Fetching tasks');
      const syncTasks = await DataWriter.getAllSyncTasks();

      log.info(`Startup/syncTasks: Queueing ${syncTasks.length} sync tasks`);
      await queueSyncTasks(syncTasks, DataWriter.removeSyncTaskById);

      log.info('Startup/syncTasks: Done');
    }

    log.info('listening for registration events');
    window.Whisper.events.on('registration_done', () => {
      log.info('handling registration event');

      strictAssert(server !== undefined, 'WebAPI not ready');

      // Once this resolves it will trigger `online` event and cause
      // `connect()`, but with `firstRun` set to `false`. Thus it is important
      // not to await it and let execution fall through.
      drop(
        server.authenticate(
          window.textsecure.storage.user.getWebAPICredentials()
        )
      );

      // Cancel throttled calls to refreshRemoteConfig since our auth changed.
      window.Signal.RemoteConfig.maybeRefreshRemoteConfig.cancel();
      drop(window.Signal.RemoteConfig.maybeRefreshRemoteConfig(server));

      drop(connect(true));

      // Connect messageReceiver back to websocket
      afterStart();

      // Run storage service after linking
      drop(runStorageService());
    });

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
    void tapToViewMessagesDeletionService.update();
    window.Whisper.events.on('timetravel', () => {
      void updateExpiringMessagesService();
      void tapToViewMessagesDeletionService.update();
    });

    const isCoreDataValid = Boolean(
      window.textsecure.storage.user.getAci() &&
        window.ConversationController.getOurConversation()
    );

    if (isCoreDataValid && Registration.everDone()) {
      drop(connect());
      if (window.storage.get('backupDownloadPath')) {
        window.reduxActions.app.openBackupImport();
      } else {
        window.reduxActions.app.openInbox();
      }
    } else {
      window.IPC.readyForUpdates();
      window.reduxActions.app.openInstaller();
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

    afterStart();
  }

  function afterStart() {
    strictAssert(messageReceiver, 'messageReceiver must be initialized');
    strictAssert(server, 'server must be initialized');

    log.info('afterStart(): emitting app-ready-for-processing');
    window.Whisper.events.trigger('app-ready-for-processing');

    const onOnline = () => {
      log.info('background: online');

      if (!remotelyExpired) {
        drop(connect());
      }
    };
    window.Whisper.events.on('online', onOnline);

    const onOffline = () => {
      const { hasInitialLoadCompleted, appView } =
        window.reduxStore.getState().app;

      const hasAppEverBeenRegistered = Registration.everDone();

      log.info('background: offline', {
        connectCount,
        hasInitialLoadCompleted,
        appView,
        hasAppEverBeenRegistered,
      });

      drop(challengeHandler?.onOffline());
      drop(AttachmentDownloadManager.stop());
      drop(AttachmentBackupManager.stop());
      drop(messageReceiver?.drain());

      if (hasAppEverBeenRegistered) {
        if (
          window.reduxStore.getState().app.appView === AppViewType.Installer
        ) {
          log.info(
            'background: offline, but app has been registered before; opening inbox'
          );
          window.reduxActions.app.openInbox();
        }

        if (!hasInitialLoadCompleted) {
          log.info(
            'background: offline; initial load not completed; triggering onEmpty'
          );
          drop(onEmpty()); // this ensures that the inbox loading progress bar is dismissed
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

    if (window.storage.get('backupDownloadPath')) {
      log.info(
        'background: not running storage service while downloading backup'
      );
      drop(downloadBackup());
      return;
    }

    server.registerRequestHandler(messageReceiver);
  }

  async function downloadBackup() {
    const backupDownloadPath = window.storage.get('backupDownloadPath');
    if (!backupDownloadPath) {
      log.warn('No backup download path, cannot download backup');
      return;
    }

    const absoluteDownloadPath =
      window.Signal.Migrations.getAbsoluteDownloadsPath(backupDownloadPath);
    log.info('downloadBackup: downloading to', absoluteDownloadPath);
    await backupsService.download(absoluteDownloadPath, {
      onProgress: (currentBytes, totalBytes) => {
        window.reduxActions.app.updateBackupImportProgress({
          currentBytes,
          totalBytes,
        });
      },
    });
    await window.storage.remove('backupDownloadPath');
    window.reduxActions.app.openInbox();

    log.info('downloadBackup: processing websocket messages, storage service');
    strictAssert(server != null, 'server must be initialized');
    strictAssert(
      messageReceiver != null,
      'MessageReceiver must be initialized'
    );
    server.registerRequestHandler(messageReceiver);
    drop(runStorageService());
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
    if (window.getSocketStatus() === SocketStatus.OPEN) {
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
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === SocketStatus.CONNECTING ||
      socketStatus === SocketStatus.OPEN
    );
  }

  let connectCount = 0;
  let connectPromise: ExplodePromiseResultType<void> | undefined;
  let remotelyExpired = false;
  async function connect(firstRun?: boolean) {
    if (connectPromise && !firstRun) {
      log.warn('background: connect already running', {
        connectCount,
        firstRun,
      });
      return;
    }
    if (connectPromise && firstRun) {
      while (connectPromise) {
        log.warn(
          'background: connect already running; waiting for previous run',
          {
            connectCount,
            firstRun,
          }
        );
        // eslint-disable-next-line no-await-in-loop
        await connectPromise.promise;
      }
      await connect(firstRun);
      return;
    }

    if (remotelyExpired) {
      log.warn('background: remotely expired, not reconnecting');
      return;
    }

    strictAssert(server !== undefined, 'WebAPI not connected');

    try {
      connectPromise = explodePromise();
      // Reset the flag and update it below if needed
      setIsInitialSync(false);

      if (!Registration.everDone()) {
        log.info('background: registration not done, not connecting');
        return;
      }

      log.info('background: connect', { firstRun, connectCount });

      // Update our profile key in the conversation if we just got linked.
      const profileKey = await ourProfileKeyService.get();
      if (firstRun && profileKey) {
        const me = window.ConversationController.getOurConversation();
        strictAssert(me !== undefined, "Didn't find newly created ourselves");
        await me.setProfileKey(Bytes.toBase64(profileKey));
      }

      if (isBackupEnabled()) {
        backupsService.start();
        drop(AttachmentBackupManager.start());
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
            const remoteBuildExpirationTimestamp = parseRemoteClientExpiration(
              expiration as string
            );
            if (remoteBuildExpirationTimestamp) {
              await window.storage.put(
                'remoteBuildExpiration',
                remoteBuildExpirationTimestamp
              );
            }
          }
        } catch (error) {
          log.error(
            'connect: Error refreshing remote config:',
            isNumber(error.code)
              ? `code: ${error.code}`
              : Errors.toLogFormat(error)
          );
        }
      }

      connectCount += 1;

      void window.Signal.Services.initializeGroupCredentialFetcher();

      drop(AttachmentDownloadManager.start());

      if (connectCount === 1) {
        Stickers.downloadQueuedPacks();
        if (!newVersion) {
          drop(runStorageService());
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

        try {
          window.getSyncRequest();

          void StorageService.reprocessUnknownFields();
          void runStorageService();

          const manager = window.getAccountManager();
          await Promise.all([
            manager.maybeUpdateDeviceName(),
            window.textsecure.storage.user.removeSignalingKey(),
          ]);
        } catch (e) {
          log.error(
            "Problem with 'boot after upgrade' tasks: ",
            Errors.toLogFormat(e)
          );
        }
      }

      const deviceId = window.textsecure.storage.user.getDeviceId();

      if (!window.textsecure.storage.user.getAci()) {
        log.error('UUID not captured during registration, unlinking');
        return unlinkAndDisconnect();
      }

      if (connectCount === 1) {
        try {
          // Note: we always have to register our capabilities all at once, so we do this
          //   after connect on every startup
          await server.registerCapabilities({
            deleteSync: true,
            versionedExpirationTimer: true,
          });
        } catch (error) {
          log.error(
            'Error: Unable to register our capabilities.',
            Errors.toLogFormat(error)
          );
        }
      }

      if (!window.textsecure.storage.user.getPni()) {
        log.error('PNI not captured during registration, unlinking softly');
        return unlinkAndDisconnect();
      }

      if (firstRun === true && deviceId !== 1) {
        if (!window.storage.get('masterKey')) {
          const lastSent = window.storage.get('masterKeyLastRequestTime') ?? 0;
          const now = Date.now();

          // If we last attempted sync one day in the past, or if we time
          // traveled.
          if (isOlderThan(lastSent, DAY) || lastSent > now) {
            log.warn('connect: masterKey not captured, requesting sync');
            await singleProtoJobQueue.add(
              MessageSender.getRequestKeySyncMessage()
            );
            await window.storage.put('masterKeyLastRequestTime', now);
          } else {
            log.warn(
              'connect: masterKey not captured, but sync requested recently.' +
                'Not running'
            );
          }
        }

        const waitForEvent = createTaskWithTimeout(
          (event: string): Promise<void> => {
            const { promise, resolve } = explodePromise<void>();
            window.Whisper.events.once(event, () => resolve());
            return promise;
          },
          'firstRun:waitForEvent',
          { timeout: 2 * durations.MINUTE }
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
        setIsInitialSync(true);

        // Request configuration, block, GV1 sync messages, contacts
        // (only avatars and inboxPosition),and Storage Service sync.
        try {
          await Promise.all([
            singleProtoJobQueue.add(
              MessageSender.getRequestConfigurationSyncMessage()
            ),
            singleProtoJobQueue.add(MessageSender.getRequestBlockSyncMessage()),
            runStorageService(),
            singleProtoJobQueue.add(
              MessageSender.getRequestContactSyncMessage()
            ),
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
        setIsInitialSync(false);

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

      drop(challengeHandler.onOnline());

      reconnectBackOff.reset();
    } finally {
      if (connectPromise) {
        connectPromise.resolve();
        connectPromise = undefined;
      } else {
        log.warn('background connect: in finally, no connectPromise!', {
          connectCount,
          firstRun,
        });
      }
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

  async function onEmpty(): Promise<void> {
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
    drop(connect());
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
          fromSync: true,
        });
      } else if (isInstall) {
        if (status === 'downloaded') {
          window.reduxActions.stickers.installStickerPack(id, key, {
            fromSync: true,
          });
        } else {
          void Stickers.downloadStickerPack(id, key, {
            finalStatus: 'installed',
            fromSync: true,
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
      message: data.message,
      // 'message' event: for 1:1 converations, the conversation is same as sender
      destination: data.source,
      destinationServiceId: data.sourceAci,
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
    drop(message.handleDataMessage(data.message, event.confirm));
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

    log.info(
      `${logId}: updating profileKey for ${idForLogging}`,
      data.sourceAci,
      data.source
    );

    const hasChanged = await conversation.setProfileKey(data.profileKey);

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

    conversation.enableProfileSharing();
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
    await me.setProfileKey(profileKey);

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
      destination,
      isAllowedToReplyToStory,
    } of unidentifiedStatus) {
      const conversation = window.ConversationController.get(
        destinationServiceId || destination
      );
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
        .map(item => item.destinationServiceId || item.destination)
        .filter(isNotNil);
    }

    const partialMessage: MessageAttributesType = {
      id: generateUuid(),
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
      sourceServiceId: window.textsecure.storage.user.getAci(),
      timestamp,
      type: data.message.isStory ? 'story' : 'outgoing',
      storyDistributionListId: data.storyDistributionListId,
      unidentifiedDeliveries,
    };

    return new window.Whisper.Message(partialMessage);
  }

  // Works with 'sent' and 'message' data sent from MessageReceiver
  const getMessageDescriptor = ({
    message,
    destination,
    destinationServiceId,
  }: {
    message: ProcessedDataMessage;
    destination?: string;
    destinationServiceId?: ServiceIdString;
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

    const conversation = window.ConversationController.get(
      destinationServiceId || destination
    );
    strictAssert(conversation, 'Destination conversation cannot be created');

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
          e164: data.destination,
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
      message.handleDataMessage(data.message, event.confirm, {
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
      id: generateUuid(),
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
      sourceServiceId: data.sourceAci,
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
      server.unregisterRequestHandler(messageReceiver);
      messageReceiver.stopProcessing();

      await server.logout();
      await window.waitForAllBatchers();
    }

    void onEmpty();

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
    const { source, sourceAci, timestamp } = ev;
    log.info(`view once open sync ${source} ${timestamp}`);
    strictAssert(sourceAci, 'ViewOnceOpen without sourceAci');
    strictAssert(timestamp, 'ViewOnceOpen without timestamp');

    const attributes: ViewOnceOpenSyncAttributesType = {
      removeFromMessageReceiverCache: ev.confirm,
      source,
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
        const ourAci = window.textsecure.storage.user.getAci();
        const ourE164 = window.textsecure.storage.user.getNumber();
        await getProfile(ourAci, ourE164);
        break;
      }
      case FETCH_LATEST_ENUM.STORAGE_MANIFEST:
        log.info('onFetchLatestSync: fetching latest manifest');
        StorageService.runStorageServiceSyncJob();
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

    const { masterKey } = ev;
    let { storageServiceKey } = ev;

    if (masterKey == null) {
      log.info('onKeysSync: deleting window.masterKey');
      await window.storage.remove('masterKey');
    } else {
      // Override provided storageServiceKey because it is deprecated.
      storageServiceKey = deriveStorageServiceKey(masterKey);
      await window.storage.put('masterKey', Bytes.toBase64(masterKey));
    }

    if (storageServiceKey == null) {
      log.info('onKeysSync: deleting window.storageKey');
      await window.storage.remove('storageKey');
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

      await StorageService.runStorageServiceSyncJob();
    }
  }

  function onMessageRequestResponse(ev: MessageRequestResponseEvent): void {
    const { threadE164, threadAci, groupV2Id, messageRequestResponseType } = ev;

    log.info('onMessageRequestResponse', {
      threadE164,
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
      threadE164,
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
