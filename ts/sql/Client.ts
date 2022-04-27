// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { ipcRenderer as ipc } from 'electron';
import fs from 'fs-extra';
import pify from 'pify';

import {
  cloneDeep,
  compact,
  fromPairs,
  get,
  groupBy,
  isFunction,
  last,
  map,
  omit,
  set,
  toPairs,
  uniq,
} from 'lodash';

import { deleteExternalFiles } from '../types/Conversation';
import * as Bytes from '../Bytes';
import { CURRENT_SCHEMA_VERSION } from '../../js/modules/types/message';
import { createBatcher } from '../util/batcher';
import { assert, strictAssert } from '../util/assert';
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
  AttachmentDownloadJobType,
  ClientInterface,
  ClientJobType,
  ClientSearchResultMessageType,
  ConversationType,
  DeleteSentProtoRecipientOptionsType,
  IdentityKeyIdType,
  IdentityKeyType,
  ItemKeyType,
  ItemType,
  ConversationMessageStatsType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyIdType,
  PreKeyType,
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
  StickerPackStatusType,
  StickerPackType,
  StickerType,
  StoryDistributionMemberType,
  StoryDistributionType,
  StoryDistributionWithMembersType,
  StoryReadType,
  UnprocessedType,
  UnprocessedUpdateType,
} from './Interface';
import Server from './Server';
import { isCorruptionError } from './errors';

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
  resolve: Function;
  reject: Function;
  args?: Array<any>;
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
let _shutdownCallback: Function | null = null;
let _shutdownPromise: Promise<any> | null = null;
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
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
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
  updateAllConversationColors,

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
  getAllUnprocessed,
  getUnprocessedById,
  updateUnprocessedWithData,
  updateUnprocessedsWithData,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  setAttachmentDownloadJobPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  createOrUpdateStickerPack,
  updateStickerPackStatus,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  getStickerCount,
  deleteStickerPack,
  getAllStickerPacks,
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
    map(toPairs(dataInterface), ([name, value]: [string, any]) => {
      if (isFunction(value)) {
        return [name, makeChannel(name)];
      }

      return null;
    })
  )
) as any;

const channels: ServerInterface = channelsAsUnknown;

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

function _cleanMessageData(data: MessageType): MessageType {
  // Ensure that all messages have the received_at set properly
  if (!data.received_at) {
    assert(false, 'received_at was not set on the message');
    data.received_at = window.Signal.Util.incrementMessageCounter();
  }
  return _cleanData(omit(data, ['dataMessage']));
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
    _shutdownCallback = (error: Error) => {
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
    resolve: (value: any) => {
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
  return async (...args: Array<any>) => {
    // During startup we want to avoid the high overhead of IPC so we utilize
    // the db that exists in the renderer process to be able to boot up quickly
    // once the app is running we switch back to the main process to avoid the
    // UI from locking up whenever we do costly db operations.
    if (state === RendererState.InRenderer) {
      const serverFnName = fnName as keyof ServerInterface;
      const start = Date.now();

      try {
        // Ignoring this error TS2556: Expected 3 arguments, but got 0 or more.
        return await (Server[serverFnName] as Function)(...args);
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

function keysToBytes(keys: Array<string>, data: any) {
  const updated = cloneDeep(data);

  const max = keys.length;
  for (let i = 0; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, Bytes.fromBase64(value));
    }
  }

  return updated;
}

function keysFromBytes(keys: Array<string>, data: any) {
  const updated = cloneDeep(data);

  const max = keys.length;
  for (let i = 0; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, Bytes.toBase64(value));
    }
  }

  return updated;
}

// Top-level calls

async function shutdown() {
  log.info('Client.shutdown');

  // Stop accepting new SQL jobs, flush outstanding queue
  await _shutdown();

  // Close database
  await close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function close() {
  await channels.close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeDB() {
  await channels.removeDB();
}

async function removeIndexedDBFiles() {
  await channels.removeIndexedDBFiles();
}

// Identity Keys

const IDENTITY_KEY_KEYS = ['publicKey'];
async function createOrUpdateIdentityKey(data: IdentityKeyType) {
  const updated = keysFromBytes(IDENTITY_KEY_KEYS, data);
  await channels.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(id: IdentityKeyIdType) {
  const data = await channels.getIdentityKeyById(id);

  return keysToBytes(IDENTITY_KEY_KEYS, data);
}
async function bulkAddIdentityKeys(array: Array<IdentityKeyType>) {
  const updated = map(array, data => keysFromBytes(IDENTITY_KEY_KEYS, data));
  await channels.bulkAddIdentityKeys(updated);
}
async function removeIdentityKeyById(id: IdentityKeyIdType) {
  await channels.removeIdentityKeyById(id);
}
async function removeAllIdentityKeys() {
  await channels.removeAllIdentityKeys();
}
async function getAllIdentityKeys() {
  const keys = await channels.getAllIdentityKeys();

  return keys.map(key => keysToBytes(IDENTITY_KEY_KEYS, key));
}

// Pre Keys

async function createOrUpdatePreKey(data: PreKeyType) {
  const updated = keysFromBytes(PRE_KEY_KEYS, data);
  await channels.createOrUpdatePreKey(updated);
}
async function getPreKeyById(id: PreKeyIdType) {
  const data = await channels.getPreKeyById(id);

  return keysToBytes(PRE_KEY_KEYS, data);
}
async function bulkAddPreKeys(array: Array<PreKeyType>) {
  const updated = map(array, data => keysFromBytes(PRE_KEY_KEYS, data));
  await channels.bulkAddPreKeys(updated);
}
async function removePreKeyById(id: PreKeyIdType) {
  await channels.removePreKeyById(id);
}
async function removeAllPreKeys() {
  await channels.removeAllPreKeys();
}
async function getAllPreKeys() {
  const keys = await channels.getAllPreKeys();

  return keys.map(key => keysToBytes(PRE_KEY_KEYS, key));
}

// Signed Pre Keys

const PRE_KEY_KEYS = ['privateKey', 'publicKey'];
async function createOrUpdateSignedPreKey(data: SignedPreKeyType) {
  const updated = keysFromBytes(PRE_KEY_KEYS, data);
  await channels.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(id: SignedPreKeyIdType) {
  const data = await channels.getSignedPreKeyById(id);

  return keysToBytes(PRE_KEY_KEYS, data);
}
async function getAllSignedPreKeys() {
  const keys = await channels.getAllSignedPreKeys();

  return keys.map((key: SignedPreKeyType) => keysToBytes(PRE_KEY_KEYS, key));
}
async function bulkAddSignedPreKeys(array: Array<SignedPreKeyType>) {
  const updated = map(array, data => keysFromBytes(PRE_KEY_KEYS, data));
  await channels.bulkAddSignedPreKeys(updated);
}
async function removeSignedPreKeyById(id: SignedPreKeyIdType) {
  await channels.removeSignedPreKeyById(id);
}
async function removeAllSignedPreKeys() {
  await channels.removeAllSignedPreKeys();
}

// Items

const ITEM_KEYS: Partial<Record<ItemKeyType, Array<string>>> = {
  senderCertificate: ['value.serialized'],
  senderCertificateNoE164: ['value.serialized'],
  subscriberId: ['value'],
  profileKey: ['value'],
};
async function createOrUpdateItem<K extends ItemKeyType>(data: ItemType<K>) {
  const { id } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateItem: Provided data did not have a truthy id'
    );
  }

  const keys = ITEM_KEYS[id];
  const updated = Array.isArray(keys) ? keysFromBytes(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<ItemType<K> | undefined> {
  const keys = ITEM_KEYS[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToBytes(keys, data) : data;
}
async function getAllItems() {
  const items = await channels.getAllItems();

  const result = Object.create(null);

  for (const id of Object.keys(items)) {
    const key = id as ItemKeyType;
    const value = items[key];

    const keys = ITEM_KEYS[key];

    const deserializedValue = Array.isArray(keys)
      ? keysToBytes(keys, { value }).value
      : value;

    result[key] = deserializedValue;
  }

  return result;
}
async function removeItemById(id: ItemKeyType) {
  await channels.removeItemById(id);
}
async function removeAllItems() {
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

async function createOrUpdateSession(data: SessionType) {
  await channels.createOrUpdateSession(data);
}
async function createOrUpdateSessions(array: Array<SessionType>) {
  await channels.createOrUpdateSessions(array);
}
async function commitDecryptResult(options: {
  senderKeys: Array<SenderKeyType>;
  sessions: Array<SessionType>;
  unprocessed: Array<UnprocessedType>;
}) {
  await channels.commitDecryptResult(options);
}
async function bulkAddSessions(array: Array<SessionType>) {
  await channels.bulkAddSessions(array);
}
async function removeSessionById(id: SessionIdType) {
  await channels.removeSessionById(id);
}

async function removeSessionsByConversation(conversationId: string) {
  await channels.removeSessionsByConversation(conversationId);
}
async function removeAllSessions() {
  await channels.removeAllSessions();
}
async function getAllSessions() {
  const sessions = await channels.getAllSessions();

  return sessions;
}

// Conversation

async function getConversationCount() {
  return channels.getConversationCount();
}

async function saveConversation(data: ConversationType) {
  await channels.saveConversation(data);
}

async function saveConversations(array: Array<ConversationType>) {
  await channels.saveConversations(array);
}

async function getConversationById(id: string) {
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

function updateConversation(data: ConversationType) {
  updateConversationBatcher.add(data);
}

async function updateConversations(array: Array<ConversationType>) {
  const { cleaned, pathsChanged } = cleanDataForIpc(array);
  assert(
    !pathsChanged.length,
    `Paths were cleaned: ${JSON.stringify(pathsChanged)}`
  );
  await channels.updateConversations(cleaned);
}

async function removeConversation(id: string) {
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

async function eraseStorageServiceStateFromConversations() {
  await channels.eraseStorageServiceStateFromConversations();
}

async function getAllConversations() {
  return channels.getAllConversations();
}

async function getAllConversationIds() {
  const ids = await channels.getAllConversationIds();

  return ids;
}

async function getAllGroupsInvolvingUuid(uuid: UUIDStringType) {
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
) {
  const messages = await channels.searchMessages(query, { limit });

  return handleSearchMessageJSON(messages);
}

async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit }: { limit?: number } = {}
) {
  const messages = await channels.searchMessagesInConversation(
    query,
    conversationId,
    { limit }
  );

  return handleSearchMessageJSON(messages);
}

// Message

async function getMessageCount(conversationId?: string) {
  return channels.getMessageCount(conversationId);
}

async function getStoryCount(conversationId: string) {
  return channels.getStoryCount(conversationId);
}

async function saveMessage(
  data: MessageType,
  options: {
    jobToInsert?: Readonly<StoredJob>;
    forceSave?: boolean;
    ourUuid: UUIDStringType;
  }
) {
  const id = await channels.saveMessage(_cleanMessageData(data), {
    ...options,
    jobToInsert: options.jobToInsert && formatJobForInsert(options.jobToInsert),
  });

  window.Whisper.ExpiringMessagesListener.update();
  window.Whisper.TapToViewMessagesListener.update();

  return id;
}

async function saveMessages(
  arrayOfMessages: ReadonlyArray<MessageType>,
  options: { forceSave?: boolean; ourUuid: UUIDStringType }
) {
  await channels.saveMessages(
    arrayOfMessages.map(message => _cleanMessageData(message)),
    options
  );

  window.Whisper.ExpiringMessagesListener.update();
  window.Whisper.TapToViewMessagesListener.update();
}

async function removeMessage(id: string) {
  const message = await getMessageById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await cleanupMessage(message);
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function removeMessages(ids: Array<string>) {
  await channels.removeMessages(ids);
}

async function getMessageById(id: string) {
  return channels.getMessageById(id);
}

async function getMessagesById(messageIds: Array<string>) {
  if (!messageIds.length) {
    return [];
  }
  return channels.getMessagesById(messageIds);
}

// For testing only
async function _getAllMessages() {
  return channels._getAllMessages();
}
async function _removeAllMessages() {
  await channels._removeAllMessages();
}

async function getAllMessageIds() {
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
  sourceUuid: string;
  sourceDevice: number;
  sent_at: number;
}) {
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
) {
  return channels.getTotalUnreadForConversation(conversationId, options);
}

async function getUnreadByConversationAndMarkRead(options: {
  conversationId: string;
  isGroup?: boolean;
  newestUnreadAt: number;
  readAt?: number;
  storyId?: UUIDStringType;
}) {
  return channels.getUnreadByConversationAndMarkRead(options);
}

async function getUnreadReactionsAndMarkRead(options: {
  conversationId: string;
  newestUnreadAt: number;
  storyId?: UUIDStringType;
}) {
  return channels.getUnreadReactionsAndMarkRead(options);
}

async function markReactionAsRead(
  targetAuthorUuid: string,
  targetTimestamp: number
) {
  return channels.markReactionAsRead(targetAuthorUuid, targetTimestamp);
}

async function removeReactionFromConversation(reaction: {
  emoji: string;
  fromId: string;
  targetAuthorUuid: string;
  targetTimestamp: number;
}) {
  return channels.removeReactionFromConversation(reaction);
}

async function addReaction(reactionObj: ReactionType) {
  return channels.addReaction(reactionObj);
}

async function _getAllReactions() {
  return channels._getAllReactions();
}
async function _removeAllReactions() {
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
    isGroup?: boolean;
    limit?: number;
    messageId?: string;
    receivedAt?: number;
    sentAt?: number;
    storyId?: string;
  }
) {
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
  sourceUuid?: string;
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
    isGroup?: boolean;
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    storyId?: UUIDStringType;
  }
) {
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
}) {
  return channels.getLastConversationMessage({ conversationId });
}
async function getMessageMetricsForConversation(
  conversationId: string,
  storyId?: UUIDStringType,
  isGroup?: boolean
) {
  const result = await channels.getMessageMetricsForConversation(
    conversationId,
    storyId,
    isGroup
  );

  return result;
}
async function getConversationRangeCenteredOnMessage(options: {
  conversationId: string;
  limit?: number;
  messageId: string;
  receivedAt: number;
  sentAt?: number;
  storyId?: UUIDStringType;
}) {
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
) {
  await channels.migrateConversationMessages(obsoleteId, currentId);
}

async function removeAllMessagesInConversation(
  conversationId: string,
  {
    logId,
  }: {
    logId: string;
  }
) {
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
    });

    if (!messages.length) {
      return;
    }

    const ids = messages.map(message => message.id);

    log.info(`removeAllMessagesInConversation/${logId}: Cleanup...`);
    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    const queue = new window.PQueue({ concurrency: 3, timeout: 1000 * 60 * 2 });
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

async function getMessagesBySentAt(sentAt: number) {
  return channels.getMessagesBySentAt(sentAt);
}

async function getExpiredMessages() {
  return channels.getExpiredMessages();
}

function getMessagesUnexpectedlyMissingExpirationStartTimestamp() {
  return channels.getMessagesUnexpectedlyMissingExpirationStartTimestamp();
}

function getSoonestMessageExpiry() {
  return channels.getSoonestMessageExpiry();
}

async function getNextTapToViewMessageTimestampToAgeOut() {
  return channels.getNextTapToViewMessageTimestampToAgeOut();
}
async function getTapToViewMessagesNeedingErase() {
  return channels.getTapToViewMessagesNeedingErase();
}

// Unprocessed

async function getUnprocessedCount() {
  return channels.getUnprocessedCount();
}

async function getAllUnprocessed() {
  return channels.getAllUnprocessed();
}

async function getUnprocessedById(id: string) {
  return channels.getUnprocessedById(id);
}

async function updateUnprocessedWithData(
  id: string,
  data: UnprocessedUpdateType
) {
  await channels.updateUnprocessedWithData(id, data);
}
async function updateUnprocessedsWithData(
  array: Array<{ id: string; data: UnprocessedUpdateType }>
) {
  await channels.updateUnprocessedsWithData(array);
}

async function removeUnprocessed(id: string | Array<string>) {
  await channels.removeUnprocessed(id);
}

async function removeAllUnprocessed() {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

async function getNextAttachmentDownloadJobs(
  limit?: number,
  options?: { timestamp?: number }
) {
  return channels.getNextAttachmentDownloadJobs(limit, options);
}
async function saveAttachmentDownloadJob(job: AttachmentDownloadJobType) {
  await channels.saveAttachmentDownloadJob(_cleanData(job));
}
async function setAttachmentDownloadJobPending(id: string, pending: boolean) {
  await channels.setAttachmentDownloadJobPending(id, pending);
}
async function resetAttachmentDownloadPending() {
  await channels.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id: string) {
  await channels.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs() {
  await channels.removeAllAttachmentDownloadJobs();
}

// Stickers

async function getStickerCount() {
  return channels.getStickerCount();
}

async function createOrUpdateStickerPack(pack: StickerPackType) {
  await channels.createOrUpdateStickerPack(pack);
}
async function updateStickerPackStatus(
  packId: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
) {
  await channels.updateStickerPackStatus(packId, status, options);
}
async function createOrUpdateSticker(sticker: StickerType) {
  await channels.createOrUpdateSticker(sticker);
}
async function updateStickerLastUsed(
  packId: string,
  stickerId: number,
  timestamp: number
) {
  await channels.updateStickerLastUsed(packId, stickerId, timestamp);
}
async function addStickerPackReference(messageId: string, packId: string) {
  await channels.addStickerPackReference(messageId, packId);
}
async function deleteStickerPackReference(messageId: string, packId: string) {
  return channels.deleteStickerPackReference(messageId, packId);
}
async function deleteStickerPack(packId: string) {
  const paths = await channels.deleteStickerPack(packId);

  return paths;
}
async function getAllStickerPacks() {
  const packs = await channels.getAllStickerPacks();

  return packs;
}
async function getAllStickers() {
  const stickers = await channels.getAllStickers();

  return stickers;
}
async function getRecentStickers() {
  const recentStickers = await channels.getRecentStickers();

  return recentStickers;
}
async function clearAllErrorStickerPackAttempts() {
  await channels.clearAllErrorStickerPackAttempts();
}

// Emojis
async function updateEmojiUsage(shortName: string) {
  await channels.updateEmojiUsage(shortName);
}
async function getRecentEmojis(limit = 32) {
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

async function removeAll() {
  await channels.removeAll();
}

async function removeAllConfiguration(type?: RemoveAllConfiguration) {
  await channels.removeAllConfiguration(type);
}

async function cleanupOrphanedAttachments() {
  await callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

async function ensureFilePermissions() {
  await callChannel(ENSURE_FILE_PERMISSIONS);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData() {
  await Promise.all([
    callChannel(ERASE_SQL_KEY),
    callChannel(ERASE_ATTACHMENTS_KEY),
    callChannel(ERASE_STICKERS_KEY),
    callChannel(ERASE_TEMP_KEY),
    callChannel(ERASE_DRAFTS_KEY),
  ]);
}

async function callChannel(name: string) {
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
) {
  const messages = await channels.getMessagesNeedingUpgrade(limit, {
    maxVersion,
  });

  return messages;
}

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit,
  });
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
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

function getMaxMessageCounter(): Promise<number | undefined> {
  return channels.getMaxMessageCounter();
}

function getStatisticsForLogging(): Promise<Record<string, string>> {
  return channels.getStatisticsForLogging();
}
