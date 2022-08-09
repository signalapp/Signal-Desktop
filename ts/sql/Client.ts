// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
import { ipcRenderer as ipc } from 'electron';
import fs from 'fs-extra';
import pify from 'pify';

import {
  compact,
  fromPairs,
  groupBy,
  isFunction,
  isTypedArray,
  last,
  map,
  omit,
  toPairs,
  uniq,
} from 'lodash';

import { deleteExternalFiles } from '../types/Conversation';
import { expiringMessagesDeletionService } from '../services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService';
import * as Bytes from '../Bytes';
import { CURRENT_SCHEMA_VERSION } from '../types/Message2';
import { createBatcher } from '../util/batcher';
import { assert, strictAssert } from '../util/assert';
import { mapObjectWithSpec } from '../util/mapObjectWithSpec';
import type { ObjectMappingSpecType } from '../util/mapObjectWithSpec';
import { cleanDataForIpc } from './cleanDataForIpc';
import type { ReactionType } from '../types/Reactions';
import type { ConversationColorType, CustomColorType } from '../types/Colors';
import type { UUIDStringType } from '../types/UUID';
import type { BadgeType } from '../badges/types';
import type { ProcessGroupCallRingRequestResult } from '../types/Calling';
import type { RemoveAllConfiguration } from '../types/RemoveAllConfiguration';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import * as log from '../logging/log';

import type { StoredJob } from '../jobs/types';
import { formatJobForInsert } from '../jobs/formatJobForInsert';
import { cleanupMessage } from '../util/cleanup';

import type {
  AllItemsType,
  AttachmentDownloadJobType,
  ClientInterface,
  ClientJobType,
  ClientSearchResultMessageType,
  ConversationType,
  ConversationMetricsType,
  DeleteSentProtoRecipientOptionsType,
  EmojiType,
  GetUnreadByConversationAndMarkReadResultType,
  GetConversationRangeCenteredOnMessageResultType,
  IdentityKeyIdType,
  IdentityKeyType,
  StoredIdentityKeyType,
  ItemKeyType,
  ItemType,
  StoredItemType,
  ConversationMessageStatsType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyIdType,
  PreKeyType,
  ReactionResultType,
  StoredPreKeyType,
  SenderKeyIdType,
  SenderKeyType,
  SentMessageDBType,
  SentMessagesType,
  SentProtoType,
  SentProtoWithMessageIdsType,
  SentRecipientsDBType,
  SentRecipientsType,
  ServerInterface,
  ServerSearchResultMessageType,
  SessionIdType,
  SessionType,
  SignedPreKeyIdType,
  SignedPreKeyType,
  StoredSignedPreKeyType,
  StickerPackStatusType,
  StickerPackInfoType,
  StickerPackType,
  StickerType,
  StoryDistributionMemberType,
  StoryDistributionType,
  StoryDistributionWithMembersType,
  StoryReadType,
  UnprocessedType,
  UnprocessedUpdateType,
  UninstalledStickerPackType,
} from './Interface';
import Server from './Server';
import { isCorruptionError } from './errors';
import { MINUTE } from '../util/durations';
import { getMessageIdForLogging } from '../util/idForLogging';

// We listen to a lot of events on ipc, often on the same channel. This prevents
//   any warnings that might be sent to the console in that case.
if (ipc && ipc.setMaxListeners) {
  ipc.setMaxListeners(0);
} else {
  log.warn('sql/Client: ipc is not available!');
}

const getRealPath = pify(fs.realpath);

const MIN_TRACE_DURATION = 10;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';
const ENSURE_FILE_PERMISSIONS = 'ensure-file-permissions';

type ClientJobUpdateType = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  args?: ReadonlyArray<unknown>;
};

enum RendererState {
  InMain = 'InMain',
  Opening = 'Opening',
  InRenderer = 'InRenderer',
  Closing = 'Closing',
}

const _jobs: { [id: string]: ClientJobType } = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback: ((error?: Error) => void) | null = null;
let _shutdownPromise: Promise<void> | null = null;
let state = RendererState.InMain;
const startupQueries = new Map<string, number>();

// Because we can't force this module to conform to an interface, we narrow our exports
//   to this one default export, which does conform to the interface.
// Note: In Javascript, you need to access the .default property when requiring it
// https://github.com/microsoft/TypeScript/issues/420
const dataInterface: ClientInterface = {
  close,
  removeDB,
  removeIndexedDBFiles,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  removePreKeyById,
  removePreKeysByUuid,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeSignedPreKeysByUuid,
  removeAllSignedPreKeys,
  getAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  removeItemById,
  removeAllItems,
  getAllItems,

  createOrUpdateSenderKey,
  getSenderKeyById,
  removeAllSenderKeys,
  getAllSenderKeys,
  removeSenderKeyById,

  insertSentProto,
  deleteSentProtosOlderThan,
  deleteSentProtoByMessageId,
  insertProtoRecipients,
  deleteSentProtoRecipient,
  getSentProtoByRecipient,
  removeAllSentProtos,
  getAllSentProtos,
  _getAllSentProtoRecipients,
  _getAllSentProtoMessageIds,

  createOrUpdateSession,
  createOrUpdateSessions,
  commitDecryptResult,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByConversation,
  removeAllSessions,
  getAllSessions,

  eraseStorageServiceStateFromConversations,
  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,
  _removeAllConversations,
  updateAllConversationColors,
  removeAllProfileKeyCredentials,

  getAllConversations,
  getAllConversationIds,
  getAllGroupsInvolvingUuid,

  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  getStoryCount,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getTotalUnreadForConversation,
  getUnreadByConversationAndMarkRead,
  getUnreadReactionsAndMarkRead,
  markReactionAsRead,
  removeReactionFromConversation,
  addReaction,
  _getAllReactions,
  _removeAllReactions,
  getMessageBySender,
  getMessageById,
  getMessagesById,
  _getAllMessages,
  _removeAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getMessagesUnexpectedlyMissingExpirationStartTimestamp,
  getSoonestMessageExpiry,
  getNextTapToViewMessageTimestampToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getOlderStories,
  getNewerMessagesByConversation,
  getMessageMetricsForConversation,
  getConversationRangeCenteredOnMessage,
  getConversationMessageStats,
  getLastConversationMessage,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,

  getUnprocessedCount,
  getAllUnprocessedAndIncrementAttempts,
  getUnprocessedById,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  removeUnprocessed,
  removeAllUnprocessed,

  getAttachmentDownloadJobById,
  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  setAttachmentDownloadJobPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  createOrUpdateStickerPack,
  updateStickerPackStatus,
  updateStickerPackInfo,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  getStickerCount,
  deleteStickerPack,
  getAllStickerPacks,
  addUninstalledStickerPack,
  removeUninstalledStickerPack,
  getInstalledStickerPacks,
  getUninstalledStickerPacks,
  installStickerPack,
  uninstallStickerPack,
  getStickerPackInfo,
  getAllStickers,
  getRecentStickers,
  clearAllErrorStickerPackAttempts,

  updateEmojiUsage,
  getRecentEmojis,

  getAllBadges,
  updateOrCreateBadges,
  badgeImageFileDownloaded,

  _getAllStoryDistributions,
  _getAllStoryDistributionMembers,
  _deleteAllStoryDistributions,
  createNewStoryDistribution,
  getAllStoryDistributionsWithMembers,
  getStoryDistributionWithMembers,
  modifyStoryDistribution,
  modifyStoryDistributionMembers,
  modifyStoryDistributionWithMembers,
  deleteStoryDistribution,

  _getAllStoryReads,
  _deleteAllStoryReads,
  addNewStoryRead,
  getLastStoryReadsForAuthor,
  countStoryReadsByConversation,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getMessageServerGuidsForSpam,

  getJobsInQueue,
  insertJob,
  deleteJob,

  processGroupCallRingRequest,
  processGroupCallRingCancelation,
  cleanExpiredGroupCallRings,

  getMaxMessageCounter,

  getStatisticsForLogging,

  // Client-side only

  shutdown,
  removeAllMessagesInConversation,

  removeOtherData,
  cleanupOrphanedAttachments,
  ensureFilePermissions,

  // Client-side only, and test-only

  startInRendererProcess,
  goBackToMainProcess,
  _jobs,
};

export default dataInterface;

async function startInRendererProcess(isTesting = false): Promise<void> {
  strictAssert(
    state === RendererState.InMain,
    `startInRendererProcess: expected ${state} to be ${RendererState.InMain}`
  );

  log.info('data.startInRendererProcess: switching to renderer process');
  state = RendererState.Opening;

  if (!isTesting) {
    ipc.send('database-ready');

    await new Promise<void>(resolve => {
      ipc.once('database-ready', () => {
        resolve();
      });
    });
  }

  const configDir = await getRealPath(ipc.sendSync('get-user-data-path'));
  const key = ipc.sendSync('user-config-key');

  await Server.initializeRenderer({ configDir, key });

  log.info('data.startInRendererProcess: switched to renderer process');

  state = RendererState.InRenderer;
}

async function goBackToMainProcess(): Promise<void> {
  if (state === RendererState.InMain) {
    log.info('goBackToMainProcess: Already in the main process');
    return;
  }

  strictAssert(
    state === RendererState.InRenderer,
    `goBackToMainProcess: expected ${state} to be ${RendererState.InRenderer}`
  );

  // We don't need to wait for pending queries since they are synchronous.
  log.info('data.goBackToMainProcess: switching to main process');
  const closePromise = close();

  // It should be the last query we run in renderer process
  state = RendererState.Closing;
  await closePromise;
  state = RendererState.InMain;

  // Print query statistics for whole startup
  const entries = Array.from(startupQueries.entries());
  startupQueries.clear();

  // Sort by decreasing duration
  entries
    .sort((a, b) => b[1] - a[1])
    .filter(([_, duration]) => duration > MIN_TRACE_DURATION)
    .forEach(([query, duration]) => {
      log.info(`startup query: ${query} ${duration}ms`);
    });

  log.info('data.goBackToMainProcess: switched to main process');
}

const channelsAsUnknown = fromPairs(
  compact(
    map(toPairs(dataInterface), ([name, value]: [string, unknown]) => {
      if (isFunction(value)) {
        return [name, makeChannel(name)];
      }

      return null;
    })
  )
) as unknown;

const channels: ServerInterface = channelsAsUnknown as ServerInterface;

function _cleanData(
  data: unknown
): ReturnType<typeof cleanDataForIpc>['cleaned'] {
  const { cleaned, pathsChanged } = cleanDataForIpc(data);

  if (pathsChanged.length) {
    log.info(
      `_cleanData cleaned the following paths: ${pathsChanged.join(', ')}`
    );
  }

  return cleaned;
}

export function _cleanMessageData(data: MessageType): MessageType {
  const result = { ...data };
  // Ensure that all messages have the received_at set properly
  if (!data.received_at) {
    assert(false, 'received_at was not set on the message');
    result.received_at = window.Signal.Util.incrementMessageCounter();
  }
  if (data.attachments) {
    const logId = getMessageIdForLogging(data);
    result.attachments = data.attachments.map((attachment, index) => {
      if (attachment.data && !isTypedArray(attachment.data)) {
        log.warn(
          `_cleanMessageData/${logId}: Attachment ${index} had non-array \`data\` field; deleting.`
        );
        return omit(attachment, ['data']);
      }

      return attachment;
    });
  }
  return _cleanData(omit(result, ['dataMessage']));
}

async function _shutdown() {
  const jobKeys = Object.keys(_jobs);
  log.info(
    `data.shutdown: shutdown requested. ${jobKeys.length} jobs outstanding`
  );

  if (_shutdownPromise) {
    await _shutdownPromise;

    return;
  }

  _shuttingDown = true;

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0 || _DEBUG) {
    return;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise<void>((resolve, reject) => {
    _shutdownCallback = (error?: Error) => {
      log.info('data.shutdown: process complete');
      if (error) {
        reject(error);

        return;
      }

      resolve();
    };
  });

  await _shutdownPromise;
}

function _makeJob(fnName: string) {
  if (_shuttingDown && fnName !== 'close') {
    throw new Error(
      `Rejecting SQL channel job (${fnName}); application is shutting down`
    );
  }

  _jobCounter += 1;
  const id = _jobCounter;

  if (_DEBUG) {
    log.info(`SQL channel job ${id} (${fnName}) started`);
  }
  _jobs[id] = {
    fnName,
    start: Date.now(),
  };

  return id;
}

function _updateJob(id: number, data: ClientJobUpdateType) {
  const { resolve, reject } = data;
  const { fnName, start } = _jobs[id];

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: (value: unknown) => {
      _removeJob(id);
      const end = Date.now();
      if (_DEBUG) {
        log.info(
          `SQL channel job ${id} (${fnName}) succeeded in ${end - start}ms`
        );
      }

      return resolve(value);
    },
    reject: (error: Error) => {
      _removeJob(id);
      const end = Date.now();
      log.info(`SQL channel job ${id} (${fnName}) failed in ${end - start}ms`);

      return reject(error);
    },
  };
}

function _removeJob(id: number) {
  if (_DEBUG) {
    _jobs[id].complete = true;

    return;
  }

  delete _jobs[id];

  if (_shutdownCallback) {
    const keys = Object.keys(_jobs);
    if (keys.length === 0) {
      _shutdownCallback();
    }
  }
}

function _getJob(id: number) {
  return _jobs[id];
}

if (ipc && ipc.on) {
  ipc.on(`${SQL_CHANNEL_KEY}-done`, (_, jobId, errorForDisplay, result) => {
    const job = _getJob(jobId);
    if (!job) {
      throw new Error(
        `Received SQL channel reply to job ${jobId}, but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (!resolve || !reject) {
      throw new Error(
        `SQL channel job ${jobId} (${fnName}): didn't have a resolve or reject`
      );
    }

    if (errorForDisplay) {
      return reject(
        new Error(
          `Error received from SQL channel job ${jobId} (${fnName}): ${errorForDisplay}`
        )
      );
    }

    return resolve(result);
  });
} else {
  log.warn('sql/Client: ipc.on is not available!');
}

function makeChannel(fnName: string) {
  return async (...args: ReadonlyArray<unknown>) => {
    // During startup we want to avoid the high overhead of IPC so we utilize
    // the db that exists in the renderer process to be able to boot up quickly
    // once the app is running we switch back to the main process to avoid the
    // UI from locking up whenever we do costly db operations.
    if (state === RendererState.InRenderer) {
      const serverFnName = fnName as keyof ServerInterface;
      const serverFn = Server[serverFnName] as (
        ...fnArgs: ReadonlyArray<unknown>
      ) => unknown;
      const start = Date.now();

      try {
        // Ignoring this error TS2556: Expected 3 arguments, but got 0 or more.
        return await serverFn(...args);
      } catch (error) {
        if (isCorruptionError(error)) {
          log.error(
            'Detected sql corruption in renderer process. ' +
              `Restarting the application immediately. Error: ${error.message}`
          );
          ipc?.send('database-error', error.stack);
        }
        log.error(
          `Renderer SQL channel job (${fnName}) error ${error.message}`
        );
        throw error;
      } finally {
        const duration = Date.now() - start;

        startupQueries.set(
          serverFnName,
          (startupQueries.get(serverFnName) || 0) + duration
        );

        if (duration > MIN_TRACE_DURATION || _DEBUG) {
          log.info(
            `Renderer SQL channel job (${fnName}) completed in ${duration}ms`
          );
        }
      }
    }

    const jobId = _makeJob(fnName);

    return createTaskWithTimeout(
      () =>
        new Promise((resolve, reject) => {
          try {
            ipc.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);

            _updateJob(jobId, {
              resolve,
              reject,
              args: _DEBUG ? args : undefined,
            });
          } catch (error) {
            _removeJob(jobId);

            reject(error);
          }
        }),
      `SQL channel job ${jobId} (${fnName})`
    )();
  };
}

function specToBytes<Input, Output>(
  spec: ObjectMappingSpecType,
  data: Input
): Output {
  return mapObjectWithSpec<string, Uint8Array>(spec, data, x =>
    Bytes.fromBase64(x)
  );
}

function specFromBytes<Input, Output>(
  spec: ObjectMappingSpecType,
  data: Input
): Output {
  return mapObjectWithSpec<Uint8Array, string>(spec, data, x =>
    Bytes.toBase64(x)
  );
}

// Top-level calls

async function shutdown(): Promise<void> {
  log.info('Client.shutdown');

  // Stop accepting new SQL jobs, flush outstanding queue
  await _shutdown();

  // Close database
  await close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function close(): Promise<void> {
  await channels.close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeDB(): Promise<void> {
  await channels.removeDB();
}

async function removeIndexedDBFiles(): Promise<void> {
  await channels.removeIndexedDBFiles();
}

// Identity Keys

const IDENTITY_KEY_SPEC = ['publicKey'];
async function createOrUpdateIdentityKey(data: IdentityKeyType): Promise<void> {
  const updated: StoredIdentityKeyType = specFromBytes(IDENTITY_KEY_SPEC, data);
  await channels.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(
  id: IdentityKeyIdType
): Promise<IdentityKeyType | undefined> {
  const data = await channels.getIdentityKeyById(id);

  return specToBytes(IDENTITY_KEY_SPEC, data);
}
async function bulkAddIdentityKeys(
  array: Array<IdentityKeyType>
): Promise<void> {
  const updated: Array<StoredIdentityKeyType> = map(array, data =>
    specFromBytes(IDENTITY_KEY_SPEC, data)
  );
  await channels.bulkAddIdentityKeys(updated);
}
async function removeIdentityKeyById(id: IdentityKeyIdType): Promise<void> {
  await channels.removeIdentityKeyById(id);
}
async function removeAllIdentityKeys(): Promise<void> {
  await channels.removeAllIdentityKeys();
}
async function getAllIdentityKeys(): Promise<Array<IdentityKeyType>> {
  const keys = await channels.getAllIdentityKeys();

  return keys.map(key => specToBytes(IDENTITY_KEY_SPEC, key));
}

// Pre Keys

async function createOrUpdatePreKey(data: PreKeyType): Promise<void> {
  const updated: StoredPreKeyType = specFromBytes(PRE_KEY_SPEC, data);
  await channels.createOrUpdatePreKey(updated);
}
async function getPreKeyById(
  id: PreKeyIdType
): Promise<PreKeyType | undefined> {
  const data = await channels.getPreKeyById(id);

  return specToBytes(PRE_KEY_SPEC, data);
}
async function bulkAddPreKeys(array: Array<PreKeyType>): Promise<void> {
  const updated: Array<StoredPreKeyType> = map(array, data =>
    specFromBytes(PRE_KEY_SPEC, data)
  );
  await channels.bulkAddPreKeys(updated);
}
async function removePreKeyById(id: PreKeyIdType): Promise<void> {
  await channels.removePreKeyById(id);
}
async function removePreKeysByUuid(uuid: UUIDStringType): Promise<void> {
  await channels.removePreKeysByUuid(uuid);
}
async function removeAllPreKeys(): Promise<void> {
  await channels.removeAllPreKeys();
}
async function getAllPreKeys(): Promise<Array<PreKeyType>> {
  const keys = await channels.getAllPreKeys();

  return keys.map(key => specToBytes(PRE_KEY_SPEC, key));
}

// Signed Pre Keys

const PRE_KEY_SPEC = ['privateKey', 'publicKey'];
async function createOrUpdateSignedPreKey(
  data: SignedPreKeyType
): Promise<void> {
  const updated: StoredSignedPreKeyType = specFromBytes(PRE_KEY_SPEC, data);
  await channels.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(
  id: SignedPreKeyIdType
): Promise<SignedPreKeyType | undefined> {
  const data = await channels.getSignedPreKeyById(id);

  return specToBytes(PRE_KEY_SPEC, data);
}
async function getAllSignedPreKeys(): Promise<Array<SignedPreKeyType>> {
  const keys = await channels.getAllSignedPreKeys();

  return keys.map(key => specToBytes(PRE_KEY_SPEC, key));
}
async function bulkAddSignedPreKeys(
  array: Array<SignedPreKeyType>
): Promise<void> {
  const updated: Array<StoredSignedPreKeyType> = map(array, data =>
    specFromBytes(PRE_KEY_SPEC, data)
  );
  await channels.bulkAddSignedPreKeys(updated);
}
async function removeSignedPreKeyById(id: SignedPreKeyIdType): Promise<void> {
  await channels.removeSignedPreKeyById(id);
}
async function removeSignedPreKeysByUuid(uuid: UUIDStringType): Promise<void> {
  await channels.removeSignedPreKeysByUuid(uuid);
}
async function removeAllSignedPreKeys(): Promise<void> {
  await channels.removeAllSignedPreKeys();
}

// Items

const ITEM_SPECS: Partial<Record<ItemKeyType, ObjectMappingSpecType>> = {
  senderCertificate: ['value.serialized'],
  senderCertificateNoE164: ['value.serialized'],
  subscriberId: ['value'],
  profileKey: ['value'],
  identityKeyMap: {
    key: 'value',
    valueSpec: {
      isMap: true,
      valueSpec: ['privKey', 'pubKey'],
    },
  },
};
async function createOrUpdateItem<K extends ItemKeyType>(
  data: ItemType<K>
): Promise<void> {
  const { id } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateItem: Provided data did not have a truthy id'
    );
  }

  const spec = ITEM_SPECS[id];
  const updated: StoredItemType<K> = spec
    ? specFromBytes(spec, data)
    : (data as unknown as StoredItemType<K>);

  await channels.createOrUpdateItem(updated);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<ItemType<K> | undefined> {
  const spec = ITEM_SPECS[id];
  const data = await channels.getItemById(id);

  return spec ? specToBytes(spec, data) : (data as unknown as ItemType<K>);
}
async function getAllItems(): Promise<AllItemsType> {
  const items = await channels.getAllItems();

  const result = Object.create(null);

  for (const id of Object.keys(items)) {
    const key = id as ItemKeyType;
    const value = items[key];

    const keys = ITEM_SPECS[key];

    const deserializedValue = keys
      ? (specToBytes(keys, { value }) as ItemType<typeof key>).value
      : value;

    result[key] = deserializedValue;
  }

  return result;
}
async function removeItemById(id: ItemKeyType): Promise<void> {
  await channels.removeItemById(id);
}
async function removeAllItems(): Promise<void> {
  await channels.removeAllItems();
}

// Sender Keys

async function createOrUpdateSenderKey(key: SenderKeyType): Promise<void> {
  await channels.createOrUpdateSenderKey(key);
}
async function getSenderKeyById(
  id: SenderKeyIdType
): Promise<SenderKeyType | undefined> {
  return channels.getSenderKeyById(id);
}
async function removeAllSenderKeys(): Promise<void> {
  await channels.removeAllSenderKeys();
}
async function getAllSenderKeys(): Promise<Array<SenderKeyType>> {
  return channels.getAllSenderKeys();
}
async function removeSenderKeyById(id: SenderKeyIdType): Promise<void> {
  return channels.removeSenderKeyById(id);
}

// Sent Protos

async function insertSentProto(
  proto: SentProtoType,
  options: {
    messageIds: SentMessagesType;
    recipients: SentRecipientsType;
  }
): Promise<number> {
  return channels.insertSentProto(proto, {
    ...options,
    messageIds: uniq(options.messageIds),
  });
}
async function deleteSentProtosOlderThan(timestamp: number): Promise<void> {
  await channels.deleteSentProtosOlderThan(timestamp);
}
async function deleteSentProtoByMessageId(messageId: string): Promise<void> {
  await channels.deleteSentProtoByMessageId(messageId);
}

async function insertProtoRecipients(options: {
  id: number;
  recipientUuid: string;
  deviceIds: Array<number>;
}): Promise<void> {
  await channels.insertProtoRecipients(options);
}
async function deleteSentProtoRecipient(
  options:
    | DeleteSentProtoRecipientOptionsType
    | ReadonlyArray<DeleteSentProtoRecipientOptionsType>
): Promise<void> {
  await channels.deleteSentProtoRecipient(options);
}

async function getSentProtoByRecipient(options: {
  now: number;
  recipientUuid: string;
  timestamp: number;
}): Promise<SentProtoWithMessageIdsType | undefined> {
  return channels.getSentProtoByRecipient(options);
}
async function removeAllSentProtos(): Promise<void> {
  await channels.removeAllSentProtos();
}
async function getAllSentProtos(): Promise<Array<SentProtoType>> {
  return channels.getAllSentProtos();
}

// Test-only:
async function _getAllSentProtoRecipients(): Promise<
  Array<SentRecipientsDBType>
> {
  return channels._getAllSentProtoRecipients();
}
async function _getAllSentProtoMessageIds(): Promise<Array<SentMessageDBType>> {
  return channels._getAllSentProtoMessageIds();
}

// Sessions

async function createOrUpdateSession(data: SessionType): Promise<void> {
  await channels.createOrUpdateSession(data);
}
async function createOrUpdateSessions(
  array: Array<SessionType>
): Promise<void> {
  await channels.createOrUpdateSessions(array);
}
async function commitDecryptResult(options: {
  senderKeys: Array<SenderKeyType>;
  sessions: Array<SessionType>;
  unprocessed: Array<UnprocessedType>;
}): Promise<void> {
  await channels.commitDecryptResult(options);
}
async function bulkAddSessions(array: Array<SessionType>): Promise<void> {
  await channels.bulkAddSessions(array);
}
async function removeSessionById(id: SessionIdType): Promise<void> {
  await channels.removeSessionById(id);
}

async function removeSessionsByConversation(
  conversationId: string
): Promise<void> {
  await channels.removeSessionsByConversation(conversationId);
}
async function removeAllSessions(): Promise<void> {
  await channels.removeAllSessions();
}
async function getAllSessions(): Promise<Array<SessionType>> {
  const sessions = await channels.getAllSessions();

  return sessions;
}

// Conversation

async function getConversationCount(): Promise<number> {
  return channels.getConversationCount();
}

async function saveConversation(data: ConversationType): Promise<void> {
  await channels.saveConversation(data);
}

async function saveConversations(
  array: Array<ConversationType>
): Promise<void> {
  await channels.saveConversations(array);
}

async function getConversationById(
  id: string
): Promise<ConversationType | undefined> {
  return channels.getConversationById(id);
}

const updateConversationBatcher = createBatcher<ConversationType>({
  name: 'sql.Client.updateConversationBatcher',
  wait: 500,
  maxSize: 20,
  processBatch: async (items: Array<ConversationType>) => {
    // We only care about the most recent update for each conversation
    const byId = groupBy(items, item => item.id);
    const ids = Object.keys(byId);
    const mostRecent = ids.map((id: string): ConversationType => {
      const maybeLast = last(byId[id]);
      assert(maybeLast !== undefined, 'Empty array in `groupBy` result');
      return maybeLast;
    });

    await updateConversations(mostRecent);
  },
});

function updateConversation(data: ConversationType): void {
  updateConversationBatcher.add(data);
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const { cleaned, pathsChanged } = cleanDataForIpc(array);
  assert(
    !pathsChanged.length,
    `Paths were cleaned: ${JSON.stringify(pathsChanged)}`
  );
  await channels.updateConversations(cleaned);
}

async function removeConversation(id: string): Promise<void> {
  const existing = await getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await deleteExternalFiles(existing, {
      deleteAttachmentData: window.Signal.Migrations.deleteAttachmentData,
    });
  }
}

async function _removeAllConversations(): Promise<void> {
  await channels._removeAllConversations();
}

async function eraseStorageServiceStateFromConversations(): Promise<void> {
  await channels.eraseStorageServiceStateFromConversations();
}

async function getAllConversations(): Promise<Array<ConversationType>> {
  return channels.getAllConversations();
}

async function getAllConversationIds(): Promise<Array<string>> {
  const ids = await channels.getAllConversationIds();

  return ids;
}

async function getAllGroupsInvolvingUuid(
  uuid: UUIDStringType
): Promise<Array<ConversationType>> {
  return channels.getAllGroupsInvolvingUuid(uuid);
}

function handleSearchMessageJSON(
  messages: Array<ServerSearchResultMessageType>
): Array<ClientSearchResultMessageType> {
  return messages.map(message => ({
    json: message.json,

    // Empty array is a default value. `message.json` has the real field
    bodyRanges: [],

    ...JSON.parse(message.json),
    snippet: message.snippet,
  }));
}

async function searchMessages(
  query: string,
  { limit }: { limit?: number } = {}
): Promise<Array<ClientSearchResultMessageType>> {
  const messages = await channels.searchMessages(query, { limit });

  return handleSearchMessageJSON(messages);
}

async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit }: { limit?: number } = {}
): Promise<Array<ClientSearchResultMessageType>> {
  const messages = await channels.searchMessagesInConversation(
    query,
    conversationId,
    { limit }
  );

  return handleSearchMessageJSON(messages);
}

// Message

async function getMessageCount(conversationId?: string): Promise<number> {
  return channels.getMessageCount(conversationId);
}

async function getStoryCount(conversationId: string): Promise<number> {
  return channels.getStoryCount(conversationId);
}

async function saveMessage(
  data: MessageType,
  options: {
    jobToInsert?: Readonly<StoredJob>;
    forceSave?: boolean;
    ourUuid: UUIDStringType;
  }
): Promise<string> {
  const id = await channels.saveMessage(_cleanMessageData(data), {
    ...options,
    jobToInsert: options.jobToInsert && formatJobForInsert(options.jobToInsert),
  });

  expiringMessagesDeletionService.update();
  tapToViewMessagesDeletionService.update();

  return id;
}

async function saveMessages(
  arrayOfMessages: ReadonlyArray<MessageType>,
  options: { forceSave?: boolean; ourUuid: UUIDStringType }
): Promise<void> {
  await channels.saveMessages(
    arrayOfMessages.map(message => _cleanMessageData(message)),
    options
  );

  expiringMessagesDeletionService.update();
  tapToViewMessagesDeletionService.update();
}

async function removeMessage(id: string): Promise<void> {
  const message = await getMessageById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await cleanupMessage(message);
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function removeMessages(ids: Array<string>): Promise<void> {
  await channels.removeMessages(ids);
}

async function getMessageById(id: string): Promise<MessageType | undefined> {
  return channels.getMessageById(id);
}

async function getMessagesById(
  messageIds: Array<string>
): Promise<Array<MessageType>> {
  if (!messageIds.length) {
    return [];
  }
  return channels.getMessagesById(messageIds);
}

// For testing only
async function _getAllMessages(): Promise<Array<MessageType>> {
  return channels._getAllMessages();
}
async function _removeAllMessages(): Promise<void> {
  await channels._removeAllMessages();
}

async function getAllMessageIds(): Promise<Array<string>> {
  const ids = await channels.getAllMessageIds();

  return ids;
}

async function getMessageBySender({
  source,
  sourceUuid,
  sourceDevice,
  sent_at,
}: {
  source: string;
  sourceUuid: UUIDStringType;
  sourceDevice: number;
  sent_at: number;
}): Promise<MessageType | undefined> {
  return channels.getMessageBySender({
    source,
    sourceUuid,
    sourceDevice,
    sent_at,
  });
}

async function getTotalUnreadForConversation(
  conversationId: string,
  options: {
    storyId: UUIDStringType | undefined;
    isGroup: boolean;
  }
): Promise<number> {
  return channels.getTotalUnreadForConversation(conversationId, options);
}

async function getUnreadByConversationAndMarkRead(options: {
  conversationId: string;
  isGroup?: boolean;
  newestUnreadAt: number;
  readAt?: number;
  storyId?: UUIDStringType;
}): Promise<GetUnreadByConversationAndMarkReadResultType> {
  return channels.getUnreadByConversationAndMarkRead(options);
}

async function getUnreadReactionsAndMarkRead(options: {
  conversationId: string;
  newestUnreadAt: number;
  storyId?: UUIDStringType;
}): Promise<Array<ReactionResultType>> {
  return channels.getUnreadReactionsAndMarkRead(options);
}

async function markReactionAsRead(
  targetAuthorUuid: string,
  targetTimestamp: number
): Promise<ReactionType | undefined> {
  return channels.markReactionAsRead(targetAuthorUuid, targetTimestamp);
}

async function removeReactionFromConversation(reaction: {
  emoji: string;
  fromId: string;
  targetAuthorUuid: string;
  targetTimestamp: number;
}): Promise<void> {
  return channels.removeReactionFromConversation(reaction);
}

async function addReaction(reactionObj: ReactionType): Promise<void> {
  return channels.addReaction(reactionObj);
}

async function _getAllReactions(): Promise<Array<ReactionType>> {
  return channels._getAllReactions();
}
async function _removeAllReactions(): Promise<void> {
  await channels._removeAllReactions();
}

function handleMessageJSON(
  messages: Array<MessageTypeUnhydrated>
): Array<MessageType> {
  return messages.map(message => JSON.parse(message.json));
}

async function getOlderMessagesByConversation(
  conversationId: string,
  {
    isGroup,
    limit = 100,
    messageId,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
    storyId,
  }: {
    isGroup: boolean;
    limit?: number;
    messageId?: string;
    receivedAt?: number;
    sentAt?: number;
    storyId: string | undefined;
  }
): Promise<Array<MessageType>> {
  const messages = await channels.getOlderMessagesByConversation(
    conversationId,
    {
      isGroup,
      limit,
      receivedAt,
      sentAt,
      messageId,
      storyId,
    }
  );

  return handleMessageJSON(messages);
}
async function getOlderStories(options: {
  conversationId?: string;
  limit?: number;
  receivedAt?: number;
  sentAt?: number;
  sourceUuid?: UUIDStringType;
}): Promise<Array<MessageType>> {
  return channels.getOlderStories(options);
}

async function getNewerMessagesByConversation(
  conversationId: string,
  {
    isGroup,
    limit = 100,
    receivedAt = 0,
    sentAt = 0,
    storyId,
  }: {
    isGroup: boolean;
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    storyId: UUIDStringType | undefined;
  }
): Promise<Array<MessageType>> {
  const messages = await channels.getNewerMessagesByConversation(
    conversationId,
    {
      isGroup,
      limit,
      receivedAt,
      sentAt,
      storyId,
    }
  );

  return handleMessageJSON(messages);
}
async function getConversationMessageStats({
  conversationId,
  isGroup,
  ourUuid,
}: {
  conversationId: string;
  isGroup?: boolean;
  ourUuid: UUIDStringType;
}): Promise<ConversationMessageStatsType> {
  const { preview, activity, hasUserInitiatedMessages } =
    await channels.getConversationMessageStats({
      conversationId,
      isGroup,
      ourUuid,
    });

  return {
    preview,
    activity,
    hasUserInitiatedMessages,
  };
}
async function getLastConversationMessage({
  conversationId,
}: {
  conversationId: string;
}): Promise<MessageType | undefined> {
  return channels.getLastConversationMessage({ conversationId });
}
async function getMessageMetricsForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
): Promise<ConversationMetricsType> {
  const result = await channels.getMessageMetricsForConversation(
    conversationId,
    storyId,
    isGroup
  );

  return result;
}
async function getConversationRangeCenteredOnMessage(options: {
  conversationId: string;
  isGroup: boolean;
  limit?: number;
  messageId: string;
  receivedAt: number;
  sentAt?: number;
  storyId: UUIDStringType | undefined;
}): Promise<GetConversationRangeCenteredOnMessageResultType<MessageType>> {
  const result = await channels.getConversationRangeCenteredOnMessage(options);

  return {
    ...result,
    older: handleMessageJSON(result.older),
    newer: handleMessageJSON(result.newer),
  };
}

function hasGroupCallHistoryMessage(
  conversationId: string,
  eraId: string
): Promise<boolean> {
  return channels.hasGroupCallHistoryMessage(conversationId, eraId);
}
async function migrateConversationMessages(
  obsoleteId: string,
  currentId: string
): Promise<void> {
  await channels.migrateConversationMessages(obsoleteId, currentId);
}

async function removeAllMessagesInConversation(
  conversationId: string,
  {
    logId,
  }: {
    logId: string;
  }
): Promise<void> {
  let messages;
  do {
    const chunkSize = 20;
    log.info(
      `removeAllMessagesInConversation/${logId}: Fetching chunk of ${chunkSize} messages`
    );
    // Yes, we really want the await in the loop. We're deleting a chunk at a
    //   time so we don't use too much memory.
    messages = await getOlderMessagesByConversation(conversationId, {
      limit: chunkSize,
      isGroup: true,
      storyId: undefined,
    });

    if (!messages.length) {
      return;
    }

    const ids = messages.map(message => message.id);

    log.info(`removeAllMessagesInConversation/${logId}: Cleanup...`);
    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    const queue = new window.PQueue({ concurrency: 3, timeout: MINUTE * 30 });
    queue.addAll(
      messages.map(
        (message: MessageType) => async () => cleanupMessage(message)
      )
    );
    await queue.onIdle();

    log.info(`removeAllMessagesInConversation/${logId}: Deleting...`);
    await channels.removeMessages(ids);
  } while (messages.length > 0);
}

async function getMessagesBySentAt(
  sentAt: number
): Promise<Array<MessageType>> {
  return channels.getMessagesBySentAt(sentAt);
}

async function getExpiredMessages(): Promise<Array<MessageType>> {
  return channels.getExpiredMessages();
}

function getMessagesUnexpectedlyMissingExpirationStartTimestamp(): Promise<
  Array<MessageType>
> {
  return channels.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
}

function getSoonestMessageExpiry(): Promise<number | undefined> {
  return channels.getSoonestMessageExpiry();
}

async function getNextTapToViewMessageTimestampToAgeOut(): Promise<
  number | undefined
> {
  return channels.getNextTapToViewMessageTimestampToAgeOut();
}
async function getTapToViewMessagesNeedingErase(): Promise<Array<MessageType>> {
  return channels.getTapToViewMessagesNeedingErase();
}

// Unprocessed

async function getUnprocessedCount(): Promise<number> {
  return channels.getUnprocessedCount();
}

async function getAllUnprocessedAndIncrementAttempts(): Promise<
  Array<UnprocessedType>
> {
  return channels.getAllUnprocessedAndIncrementAttempts();
}

async function getUnprocessedById(
  id: string
): Promise<UnprocessedType | undefined> {
  return channels.getUnprocessedById(id);
}

async function updateUnprocessedWithData(
  id: string,
  data: UnprocessedUpdateType
): Promise<void> {
  await channels.updateUnprocessedWithData(id, data);
}
async function updateUnprocessedsWithData(
  array: Array<{ id: string; data: UnprocessedUpdateType }>
): Promise<void> {
  await channels.updateUnprocessedsWithData(array);
}

async function removeUnprocessed(id: string | Array<string>): Promise<void> {
  await channels.removeUnprocessed(id);
}

async function removeAllUnprocessed(): Promise<void> {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

async function getAttachmentDownloadJobById(
  id: string
): Promise<AttachmentDownloadJobType | undefined> {
  return channels.getAttachmentDownloadJobById(id);
}
async function getNextAttachmentDownloadJobs(
  limit?: number,
  options?: { timestamp?: number }
): Promise<Array<AttachmentDownloadJobType>> {
  return channels.getNextAttachmentDownloadJobs(limit, options);
}
async function saveAttachmentDownloadJob(
  job: AttachmentDownloadJobType
): Promise<void> {
  await channels.saveAttachmentDownloadJob(_cleanData(job));
}
async function setAttachmentDownloadJobPending(
  id: string,
  pending: boolean
): Promise<void> {
  await channels.setAttachmentDownloadJobPending(id, pending);
}
async function resetAttachmentDownloadPending(): Promise<void> {
  await channels.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id: string): Promise<void> {
  await channels.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs(): Promise<void> {
  await channels.removeAllAttachmentDownloadJobs();
}

// Stickers

async function getStickerCount(): Promise<number> {
  return channels.getStickerCount();
}

async function createOrUpdateStickerPack(pack: StickerPackType): Promise<void> {
  await channels.createOrUpdateStickerPack(pack);
}
async function updateStickerPackStatus(
  packId: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
): Promise<void> {
  await channels.updateStickerPackStatus(packId, status, options);
}
async function updateStickerPackInfo(info: StickerPackInfoType): Promise<void> {
  await channels.updateStickerPackInfo(info);
}
async function createOrUpdateSticker(sticker: StickerType): Promise<void> {
  await channels.createOrUpdateSticker(sticker);
}
async function updateStickerLastUsed(
  packId: string,
  stickerId: number,
  timestamp: number
): Promise<void> {
  return channels.updateStickerLastUsed(packId, stickerId, timestamp);
}
async function addStickerPackReference(
  messageId: string,
  packId: string
): Promise<void> {
  await channels.addStickerPackReference(messageId, packId);
}
async function deleteStickerPackReference(
  messageId: string,
  packId: string
): Promise<ReadonlyArray<string> | undefined> {
  return channels.deleteStickerPackReference(messageId, packId);
}
async function deleteStickerPack(packId: string): Promise<Array<string>> {
  return channels.deleteStickerPack(packId);
}
async function getAllStickerPacks(): Promise<Array<StickerPackType>> {
  const packs = await channels.getAllStickerPacks();

  return packs;
}
async function addUninstalledStickerPack(
  pack: UninstalledStickerPackType
): Promise<void> {
  return channels.addUninstalledStickerPack(pack);
}
async function removeUninstalledStickerPack(packId: string): Promise<void> {
  return channels.removeUninstalledStickerPack(packId);
}
async function getInstalledStickerPacks(): Promise<Array<StickerPackType>> {
  return channels.getInstalledStickerPacks();
}
async function getUninstalledStickerPacks(): Promise<
  Array<UninstalledStickerPackType>
> {
  return channels.getUninstalledStickerPacks();
}
async function installStickerPack(
  packId: string,
  timestamp: number
): Promise<void> {
  return channels.installStickerPack(packId, timestamp);
}
async function uninstallStickerPack(
  packId: string,
  timestamp: number
): Promise<void> {
  return channels.uninstallStickerPack(packId, timestamp);
}
async function getStickerPackInfo(
  packId: string
): Promise<StickerPackInfoType | undefined> {
  return channels.getStickerPackInfo(packId);
}
async function getAllStickers(): Promise<Array<StickerType>> {
  const stickers = await channels.getAllStickers();

  return stickers;
}
async function getRecentStickers(): Promise<Array<StickerType>> {
  const recentStickers = await channels.getRecentStickers();

  return recentStickers;
}
async function clearAllErrorStickerPackAttempts(): Promise<void> {
  await channels.clearAllErrorStickerPackAttempts();
}

// Emojis
async function updateEmojiUsage(shortName: string): Promise<void> {
  await channels.updateEmojiUsage(shortName);
}
async function getRecentEmojis(limit = 32): Promise<Array<EmojiType>> {
  return channels.getRecentEmojis(limit);
}

// Badges

function getAllBadges(): Promise<Array<BadgeType>> {
  return channels.getAllBadges();
}

async function updateOrCreateBadges(
  badges: ReadonlyArray<BadgeType>
): Promise<void> {
  if (badges.length) {
    await channels.updateOrCreateBadges(badges);
  }
}

function badgeImageFileDownloaded(
  url: string,
  localPath: string
): Promise<void> {
  return channels.badgeImageFileDownloaded(url, localPath);
}

// Story Distributions

async function _getAllStoryDistributions(): Promise<
  Array<StoryDistributionType>
> {
  return channels._getAllStoryDistributions();
}
async function _getAllStoryDistributionMembers(): Promise<
  Array<StoryDistributionMemberType>
> {
  return channels._getAllStoryDistributionMembers();
}
async function _deleteAllStoryDistributions(): Promise<void> {
  await channels._deleteAllStoryDistributions();
}
async function createNewStoryDistribution(
  distribution: StoryDistributionWithMembersType
): Promise<void> {
  await channels.createNewStoryDistribution(distribution);
}
async function getAllStoryDistributionsWithMembers(): Promise<
  Array<StoryDistributionWithMembersType>
> {
  return channels.getAllStoryDistributionsWithMembers();
}
async function getStoryDistributionWithMembers(
  id: string
): Promise<StoryDistributionWithMembersType | undefined> {
  return channels.getStoryDistributionWithMembers(id);
}
async function modifyStoryDistribution(
  distribution: StoryDistributionType
): Promise<void> {
  await channels.modifyStoryDistribution(distribution);
}
async function modifyStoryDistributionMembers(
  id: string,
  options: {
    toAdd: Array<UUIDStringType>;
    toRemove: Array<UUIDStringType>;
  }
): Promise<void> {
  await channels.modifyStoryDistributionMembers(id, options);
}
async function modifyStoryDistributionWithMembers(
  distribution: StoryDistributionType,
  options: {
    toAdd: Array<UUIDStringType>;
    toRemove: Array<UUIDStringType>;
  }
): Promise<void> {
  await channels.modifyStoryDistributionWithMembers(distribution, options);
}
async function deleteStoryDistribution(id: UUIDStringType): Promise<void> {
  await channels.deleteStoryDistribution(id);
}

// Story Reads

async function _getAllStoryReads(): Promise<Array<StoryReadType>> {
  return channels._getAllStoryReads();
}
async function _deleteAllStoryReads(): Promise<void> {
  await channels._deleteAllStoryReads();
}
async function addNewStoryRead(read: StoryReadType): Promise<void> {
  return channels.addNewStoryRead(read);
}
async function getLastStoryReadsForAuthor(options: {
  authorId: UUIDStringType;
  conversationId?: UUIDStringType;
  limit?: number;
}): Promise<Array<StoryReadType>> {
  return channels.getLastStoryReadsForAuthor(options);
}
async function countStoryReadsByConversation(
  conversationId: string
): Promise<number> {
  return channels.countStoryReadsByConversation(conversationId);
}

// Other

async function removeAll(): Promise<void> {
  await channels.removeAll();
}

async function removeAllConfiguration(
  type?: RemoveAllConfiguration
): Promise<void> {
  await channels.removeAllConfiguration(type);
}

async function cleanupOrphanedAttachments(): Promise<void> {
  await callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

async function ensureFilePermissions(): Promise<void> {
  await callChannel(ENSURE_FILE_PERMISSIONS);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData(): Promise<void> {
  await Promise.all([
    callChannel(ERASE_SQL_KEY),
    callChannel(ERASE_ATTACHMENTS_KEY),
    callChannel(ERASE_STICKERS_KEY),
    callChannel(ERASE_TEMP_KEY),
    callChannel(ERASE_DRAFTS_KEY),
  ]);
}

async function callChannel(name: string): Promise<void> {
  return createTaskWithTimeout(
    () =>
      new Promise<void>((resolve, reject) => {
        ipc.send(name);
        ipc.once(`${name}-done`, (_, error) => {
          if (error) {
            reject(error);

            return;
          }

          resolve();
        });
      }),
    `callChannel call to ${name}`
  )();
}

async function getMessagesNeedingUpgrade(
  limit: number,
  { maxVersion = CURRENT_SCHEMA_VERSION }: { maxVersion: number }
): Promise<Array<MessageType>> {
  const messages = await channels.getMessagesNeedingUpgrade(limit, {
    maxVersion,
  });

  return messages;
}

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  { limit }: { limit: number }
): Promise<Array<MessageType>> {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit,
  });
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  { limit }: { limit: number }
): Promise<Array<MessageType>> {
  return channels.getMessagesWithFileAttachments(conversationId, {
    limit,
  });
}

function getMessageServerGuidsForSpam(
  conversationId: string
): Promise<Array<string>> {
  return channels.getMessageServerGuidsForSpam(conversationId);
}

function getJobsInQueue(queueType: string): Promise<Array<StoredJob>> {
  return channels.getJobsInQueue(queueType);
}

function insertJob(job: Readonly<StoredJob>): Promise<void> {
  return channels.insertJob(job);
}

function deleteJob(id: string): Promise<void> {
  return channels.deleteJob(id);
}

function processGroupCallRingRequest(
  ringId: bigint
): Promise<ProcessGroupCallRingRequestResult> {
  return channels.processGroupCallRingRequest(ringId);
}

function processGroupCallRingCancelation(ringId: bigint): Promise<void> {
  return channels.processGroupCallRingCancelation(ringId);
}

async function cleanExpiredGroupCallRings(): Promise<void> {
  await channels.cleanExpiredGroupCallRings();
}

async function updateAllConversationColors(
  conversationColor?: ConversationColorType,
  customColorData?: {
    id: string;
    value: CustomColorType;
  }
): Promise<void> {
  return channels.updateAllConversationColors(
    conversationColor,
    customColorData
  );
}

async function removeAllProfileKeyCredentials(): Promise<void> {
  return channels.removeAllProfileKeyCredentials();
}

function getMaxMessageCounter(): Promise<number | undefined> {
  return channels.getMaxMessageCounter();
}

function getStatisticsForLogging(): Promise<Record<string, string>> {
  return channels.getStatisticsForLogging();
}
