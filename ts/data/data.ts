import { ipcRenderer } from 'electron';

// tslint:disable: no-require-imports no-var-requires one-variable-per-declaration no-void-expression
// tslint:disable: function-name

import _ from 'lodash';
import { MessageResultProps } from '../components/search/MessageSearchResults';
import {
  ConversationCollection,
  ConversationModel,
  ConversationTypeEnum,
} from '../models/conversation';
import { MessageCollection, MessageModel } from '../models/message';
import { MessageAttributes, MessageDirection } from '../models/messageType';
import { HexKeyPair } from '../receiver/keypairs';
import { getConversationController } from '../session/conversations';
import { getSodium } from '../session/crypto';
import { PubKey } from '../session/types';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';
import { ReduxConversationType } from '../state/ducks/conversations';
import { channels } from './channels';
import { channelsToMake as channelstoMakeOpenGroupV2 } from './opengroups';

const DATABASE_UPDATE_TIMEOUT = 2 * 60 * 1000; // two minutes

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

export const _jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback: any = null;
let _shutdownPromise: any = null;

export type StorageItem = {
  id: string;
  value: any;
  timestamp?: number;
};

export type IdentityKey = {
  id: string;
  publicKey: ArrayBuffer;
  firstUse: boolean;
  nonblockingApproval: boolean;
  secretKey?: string; // found in medium groups
};

export type GuardNode = {
  ed25519PubKey: string;
};

export interface Snode {
  ip: string;
  port: number;
  pubkey_x25519: string;
  pubkey_ed25519: string;
}

export type SwarmNode = Snode & {
  address: string;
};

export type ServerToken = {
  serverUrl: string;
  token: string;
};

export const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
export const lastAvatarUploadTimestamp = 'lastAvatarUploadTimestamp';
export const hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';

const channelsToMake = {
  shutdown,
  close,
  removeDB,
  getPasswordHash,

  getGuardNodes,
  updateGuardNodes,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  removeItemById,

  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,

  saveConversation,
  getConversationById,
  updateConversation,
  removeConversation,

  getAllConversations,
  getAllOpenGroupV1Conversations,
  getPubkeysInPublicConversation,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  saveMessage,
  cleanSeenMessages,
  cleanLastHashes,
  updateLastHash,
  saveSeenMessageHashes,
  saveMessages,
  removeMessage,
  _removeMessages,
  getUnreadByConversation,
  getUnreadCountByConversation,
  getMessageCountByType,

  removeAllMessagesInConversation,

  getMessageCount,
  getMessageBySenderAndSentAt,
  getMessageBySenderAndServerTimestamp,
  getMessageBySenderAndTimestamp,
  getMessageIdsFromServerIds,
  getMessageById,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,
  getLastMessagesByConversation,
  getOldestMessageInConversation,
  getFirstUnreadMessageIdInConversation,
  getFirstUnreadMessageWithMention,
  hasConversationOutgoingMessage,
  getSeenMessagesByHashList,
  getLastHashBySnode,
  trimMessages,

  getUnprocessedCount,
  getAllUnprocessed,
  getUnprocessedById,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
  removeUnprocessed,
  removeAllUnprocessed,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  setAttachmentDownloadJobPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  removeAll,
  removeAllConversations,

  removeOtherData,
  cleanupOrphanedAttachments,

  // Returning plain JSON
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  addClosedGroupEncryptionKeyPair,
  removeAllClosedGroupEncryptionKeyPairs,
  removeOneOpenGroupV1Message,

  // dev performance testing
  fillWithTestData,

  // open group v2
  ...channelstoMakeOpenGroupV2,
};

export function init() {
  // We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
  //   any warnings that might be sent to the console in that case.
  ipcRenderer.setMaxListeners(0);

  _.forEach(channelsToMake, fn => {
    if (_.isFunction(fn)) {
      makeChannel(fn.name);
    }
  });

  ipcRenderer.on(`${SQL_CHANNEL_KEY}-done`, (_event, jobId, errorForDisplay, result) => {
    const job = _getJob(jobId);
    if (!job) {
      throw new Error(
        `Received SQL channel reply to job ${jobId}, but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (errorForDisplay) {
      return reject(
        new Error(`Error received from SQL channel job ${jobId} (${fnName}): ${errorForDisplay}`)
      );
    }

    return resolve(result);
  });
}

/**
 * When IPC arguments are prepared for the cross-process send, they are JSON.stringified.
 * We can't send ArrayBuffers or BigNumbers (what we get from proto library for dates).
 * @param data - data to be cleaned
 */
function _cleanData(data: any): any {
  const keys = Object.keys(data);

  for (let index = 0, max = keys.length; index < max; index += 1) {
    const key = keys[index];
    const value = data[key];

    if (value === null || value === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable no-param-reassign

    if (_.isFunction(value.toNumber)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.toNumber();
    } else if (_.isFunction(value)) {
      // just skip a function which has not a toNumber function. We don't want to save a function to the db.
      // an attachment comes with a toJson() function
      // tslint:disable-next-line: no-dynamic-delete
      delete data[key];
    } else if (Array.isArray(value)) {
      data[key] = value.map(_cleanData);
    } else if (_.isObject(value) && value instanceof File) {
      data[key] = { name: value.name, path: value.path, size: value.size, type: value.type };
    } else if (_.isObject(value)) {
      data[key] = _cleanData(value);
    } else if (_.isBoolean(value)) {
      data[key] = value ? 1 : 0;
    } else if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      window?.log?.info(`_cleanData: key ${key} had type ${typeof value}`);
    }
  }
  return data;
}

async function _shutdown() {
  if (_shutdownPromise) {
    return _shutdownPromise;
  }

  _shuttingDown = true;

  const jobKeys = Object.keys(_jobs);
  window?.log?.info(`data.shutdown: starting process. ${jobKeys.length} jobs outstanding`);

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0) {
    return null;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise((resolve, reject) => {
    _shutdownCallback = (error: any) => {
      window?.log?.info('data.shutdown: process complete');
      if (error) {
        return reject(error);
      }

      return resolve(undefined);
    };
  });

  return _shutdownPromise;
}

function _makeJob(fnName: string) {
  if (_shuttingDown && fnName !== 'close') {
    throw new Error(`Rejecting SQL channel job (${fnName}); application is shutting down`);
  }

  _jobCounter += 1;
  const id = _jobCounter;

  if (_DEBUG) {
    window?.log?.debug(`SQL channel job ${id} (${fnName}) started`);
  }
  _jobs[id] = {
    fnName,
    start: Date.now(),
  };

  return id;
}

function _updateJob(id: number, data: any) {
  const { resolve, reject } = data;
  const { fnName, start } = _jobs[id];

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: (value: any) => {
      _removeJob(id);
      if (_DEBUG) {
        const end = Date.now();
        const delta = end - start;
        if (delta > 10) {
          window?.log?.debug(`SQL channel job ${id} (${fnName}) succeeded in ${end - start}ms`);
        }
      }
      return resolve(value);
    },
    reject: (error: any) => {
      _removeJob(id);
      const end = Date.now();
      window?.log?.warn(`SQL channel job ${id} (${fnName}) failed in ${end - start}ms`);
      return reject(error);
    },
  };
}

function _removeJob(id: number) {
  if (_DEBUG) {
    _jobs[id].complete = true;
    return;
  }

  if (_jobs[id].timer) {
    global.clearTimeout(_jobs[id].timer);
    _jobs[id].timer = null;
  }

  // tslint:disable-next-line: no-dynamic-delete
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

function makeChannel(fnName: string) {
  channels[fnName] = async (...args: any) => {
    const jobId = _makeJob(fnName);

    return new Promise((resolve, reject) => {
      ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);

      _updateJob(jobId, {
        resolve,
        reject,
        args: _DEBUG ? args : null,
      });

      _jobs[jobId].timer = setTimeout(
        () => reject(new Error(`SQL channel job ${jobId} (${fnName}) timed out`)),
        DATABASE_UPDATE_TIMEOUT
      );
    });
  };
}

function keysToArrayBuffer(keys: any, data: any) {
  const updated = _.cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = _.get(data, key);

    if (value) {
      _.set(updated, key, fromBase64ToArrayBuffer(value));
    }
  }

  return updated;
}

function keysFromArrayBuffer(keys: any, data: any) {
  const updated = _.cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = _.get(data, key);

    if (value) {
      _.set(updated, key, fromArrayBufferToBase64(value));
    }
  }

  return updated;
}

// Basic
export async function shutdown(): Promise<void> {
  // Stop accepting new SQL jobs, flush outstanding queue
  await _shutdown();
  await close();
}
// Note: will need to restart the app after calling this, to set up afresh
export async function close(): Promise<void> {
  await channels.close();
}

// Note: will need to restart the app after calling this, to set up afresh
export async function removeDB(): Promise<void> {
  await channels.removeDB();
}

// Password hash

export async function getPasswordHash(): Promise<string | null> {
  return channels.getPasswordHash();
}

// Guard Nodes
export async function getGuardNodes(): Promise<Array<GuardNode>> {
  return channels.getGuardNodes();
}
export async function updateGuardNodes(nodes: Array<string>): Promise<void> {
  return channels.updateGuardNodes(nodes);
}

// Items

const ITEM_KEYS: Object = {
  identityKey: ['value.pubKey', 'value.privKey'],
  profileKey: ['value'],
};
export async function createOrUpdateItem(data: StorageItem): Promise<void> {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdateItem: Provided data did not have a truthy id');
  }

  const keys = (ITEM_KEYS as any)[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}
export async function getItemById(id: string): Promise<StorageItem | undefined> {
  const keys = (ITEM_KEYS as any)[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}

export async function generateAttachmentKeyIfEmpty() {
  const existingKey = await getItemById('local_attachment_encrypted_key');
  if (!existingKey) {
    const sodium = await getSodium();
    const encryptingKey = sodium.to_hex(sodium.randombytes_buf(32));
    await createOrUpdateItem({
      id: 'local_attachment_encrypted_key',
      value: encryptingKey,
    });
    // be sure to write the new key to the cache. so we can access it straight away
    window.textsecure.storage.put('local_attachment_encrypted_key', encryptingKey);
  }
}

export async function getAllItems(): Promise<Array<StorageItem>> {
  const items = await channels.getAllItems();
  return _.map(items, item => {
    const { id } = item;
    const keys = (ITEM_KEYS as any)[id];
    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}
export async function removeItemById(id: string): Promise<void> {
  await channels.removeItemById(id);
}

// Swarm nodes
export async function getSwarmNodesForPubkey(pubkey: string): Promise<Array<string>> {
  return channels.getSwarmNodesForPubkey(pubkey);
}

export async function updateSwarmNodesForPubkey(
  pubkey: string,
  snodeEdKeys: Array<string>
): Promise<void> {
  await channels.updateSwarmNodesForPubkey(pubkey, snodeEdKeys);
}

// Closed group

/**
 * The returned array is ordered based on the timestamp, the latest is at the end.
 */
export async function getAllEncryptionKeyPairsForGroup(
  groupPublicKey: string | PubKey
): Promise<Array<HexKeyPair> | undefined> {
  const pubkey = (groupPublicKey as PubKey).key || (groupPublicKey as string);
  return channels.getAllEncryptionKeyPairsForGroup(pubkey);
}

export async function getLatestClosedGroupEncryptionKeyPair(
  groupPublicKey: string
): Promise<HexKeyPair | undefined> {
  return channels.getLatestClosedGroupEncryptionKeyPair(groupPublicKey);
}

export async function addClosedGroupEncryptionKeyPair(
  groupPublicKey: string,
  keypair: HexKeyPair
): Promise<void> {
  await channels.addClosedGroupEncryptionKeyPair(groupPublicKey, keypair);
}

export async function removeAllClosedGroupEncryptionKeyPairs(
  groupPublicKey: string
): Promise<void> {
  return channels.removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
}

// Conversation
export async function saveConversation(data: ReduxConversationType): Promise<void> {
  const cleaned = _.omit(data, 'isOnline');
  await channels.saveConversation(cleaned);
}

export async function getConversationById(id: string): Promise<ConversationModel | undefined> {
  const data = await channels.getConversationById(id);
  if (data) {
    return new ConversationModel(data);
  }
  return undefined;
}

export async function updateConversation(data: ReduxConversationType): Promise<void> {
  const cleanedData = _cleanData(data);
  await channels.updateConversation(cleanedData);
}

export async function removeConversation(id: string): Promise<void> {
  const existing = await getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await existing.cleanup();
  }
}

export async function getAllConversations(): Promise<ConversationCollection> {
  const conversations = await channels.getAllConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

export async function getAllOpenGroupV1Conversations(): Promise<ConversationCollection> {
  const conversations = await channels.getAllOpenGroupV1Conversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

/**
 * This returns at most MAX_PUBKEYS_MEMBERS members, the last MAX_PUBKEYS_MEMBERS members who wrote in the chat
 */
export async function getPubkeysInPublicConversation(id: string): Promise<Array<string>> {
  return channels.getPubkeysInPublicConversation(id);
}

export async function getAllGroupsInvolvingId(id: string): Promise<ConversationCollection> {
  const conversations = await channels.getAllGroupsInvolvingId(id);

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

export async function searchConversations(query: string): Promise<Array<any>> {
  const conversations = await channels.searchConversations(query);
  return conversations;
}

export async function searchMessages(
  query: string,
  limit: number
): Promise<Array<MessageResultProps>> {
  const messages = (await channels.searchMessages(query, limit)) as Array<MessageResultProps>;
  return _.uniqWith(messages, (left: { id: string }, right: { id: string }) => {
    return left.id === right.id;
  });
}

/**
 * Returns just json objects not MessageModel
 */
export async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  limit: number
): Promise<Array<MessageAttributes>> {
  const messages = (await channels.searchMessagesInConversation(query, conversationId, {
    limit,
  })) as Array<MessageAttributes>;
  return messages;
}

// Message

export async function cleanSeenMessages(): Promise<void> {
  await channels.cleanSeenMessages();
}

export async function cleanLastHashes(): Promise<void> {
  await channels.cleanLastHashes();
}

export async function saveSeenMessageHashes(
  data: Array<{
    expiresAt: number;
    hash: string;
  }>
): Promise<void> {
  await channels.saveSeenMessageHashes(_cleanData(data));
}

export async function updateLastHash(data: {
  convoId: string;
  snode: string;
  hash: string;
  expiresAt: number;
}): Promise<void> {
  await channels.updateLastHash(_cleanData(data));
}

export async function saveMessage(data: MessageAttributes): Promise<string> {
  const cleanedData = _cleanData(data);
  const id = await channels.saveMessage(cleanedData);
  window.Whisper.ExpiringMessagesListener.update();
  return id;
}

export async function saveMessages(arrayOfMessages: Array<MessageAttributes>): Promise<void> {
  await channels.saveMessages(_cleanData(arrayOfMessages));
}

export async function removeMessage(id: string): Promise<void> {
  const message = await getMessageById(id, true);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await message.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
export async function _removeMessages(ids: Array<string>): Promise<void> {
  await channels.removeMessage(ids);
}

export async function getMessageIdsFromServerIds(
  serverIds: Array<string> | Array<number>,
  conversationId: string
): Promise<Array<string> | undefined> {
  return channels.getMessageIdsFromServerIds(serverIds, conversationId);
}

export async function getMessageById(
  id: string,
  skipTimerInit: boolean = false
): Promise<MessageModel | null> {
  const message = await channels.getMessageById(id);
  if (!message) {
    return null;
  }
  if (skipTimerInit) {
    message.skipTimerInit = skipTimerInit;
  }

  return new MessageModel(message);
}

export async function getMessageBySenderAndSentAt({
  source,
  sentAt,
}: {
  source: string;
  sentAt: number;
}): Promise<MessageModel | null> {
  const messages = await channels.getMessageBySenderAndSentAt({
    source,
    sentAt,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new MessageModel(messages[0]);
}

export async function getMessageBySenderAndServerTimestamp({
  source,
  serverTimestamp,
}: {
  source: string;
  serverTimestamp: number;
}): Promise<MessageModel | null> {
  const messages = await channels.getMessageBySenderAndServerTimestamp({
    source,
    serverTimestamp,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new MessageModel(messages[0]);
}

/**
 *
 * @param source senders id
 * @param timestamp the timestamp of the message - not to be confused with the serverTimestamp. This is equivalent to sent_at
 */
export async function getMessageBySenderAndTimestamp({
  source,
  timestamp,
}: {
  source: string;
  timestamp: number;
}): Promise<MessageModel | null> {
  const messages = await channels.getMessageBySenderAndTimestamp({
    source,
    timestamp,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new MessageModel(messages[0]);
}

export async function getUnreadByConversation(conversationId: string): Promise<MessageCollection> {
  const messages = await channels.getUnreadByConversation(conversationId);
  return new MessageCollection(messages);
}

// might throw
export async function getUnreadCountByConversation(conversationId: string): Promise<number> {
  return channels.getUnreadCountByConversation(conversationId);
}

/**
 * Gets the count of messages for a direction
 * @param conversationId Conversation for messages to retrieve from
 * @param type outgoing/incoming
 */
export async function getMessageCountByType(
  conversationId: string,
  type?: MessageDirection
): Promise<number> {
  return channels.getMessageCountByType(conversationId, type);
}

export async function getMessagesByConversation(
  conversationId: string,
  { skipTimerInit = false, messageId = null }: { skipTimerInit?: false; messageId: string | null }
): Promise<MessageCollection> {
  const messages = await channels.getMessagesByConversation(conversationId, {
    messageId,
  });
  if (skipTimerInit) {
    for (const message of messages) {
      message.skipTimerInit = skipTimerInit;
    }
  }
  return new MessageCollection(messages);
}

/**
 * This function should only be used when you don't want to render the messages.
 * It just grabs the last messages of a conversation.
 *
 * To be used when you want for instance to remove messages from a conversations, in order.
 * Or to trigger downloads of a attachments from a just approved contact (clicktotrustSender)
 * @param conversationId the conversationId to fetch messages from
 * @param limit the maximum number of messages to return
 * @param skipTimerInit  see MessageModel.skipTimerInit
 * @returns the fetched messageModels
 */
export async function getLastMessagesByConversation(
  conversationId: string,
  limit: number,
  skipTimerInit: boolean
): Promise<MessageCollection> {
  const messages = await channels.getLastMessagesByConversation(conversationId, limit);
  if (skipTimerInit) {
    for (const message of messages) {
      message.skipTimerInit = skipTimerInit;
    }
  }
  return new MessageCollection(messages);
}

export async function getLastMessageIdInConversation(conversationId: string) {
  const collection = await getLastMessagesByConversation(conversationId, 1, true);
  return collection.models.length ? collection.models[0].id : null;
}

export async function getLastMessageInConversation(conversationId: string) {
  const messages = await channels.getLastMessagesByConversation(conversationId, 1);
  for (const message of messages) {
    message.skipTimerInit = true;
  }

  const collection = new MessageCollection(messages);
  return collection.length ? collection.models[0] : null;
}

export async function getOldestMessageInConversation(conversationId: string) {
  const messages = await channels.getOldestMessageInConversation(conversationId);
  for (const message of messages) {
    message.skipTimerInit = true;
  }

  const collection = new MessageCollection(messages);
  return collection.length ? collection.models[0] : null;
}

/**
 * @returns Returns count of all messages in the database
 */
export async function getMessageCount() {
  return channels.getMessageCount();
}

export async function getFirstUnreadMessageIdInConversation(
  conversationId: string
): Promise<string | undefined> {
  return channels.getFirstUnreadMessageIdInConversation(conversationId);
}

export async function getFirstUnreadMessageWithMention(
  conversationId: string,
  ourPubkey: string
): Promise<string | undefined> {
  return channels.getFirstUnreadMessageWithMention(conversationId, ourPubkey);
}

export async function hasConversationOutgoingMessage(conversationId: string): Promise<boolean> {
  return channels.hasConversationOutgoingMessage(conversationId);
}
export async function getLastHashBySnode(convoId: string, snode: string): Promise<string> {
  return channels.getLastHashBySnode(convoId, snode);
}

export async function getSeenMessagesByHashList(hashes: Array<string>): Promise<any> {
  return channels.getSeenMessagesByHashList(hashes);
}

export async function removeAllMessagesInConversation(conversationId: string): Promise<void> {
  let messages;
  do {
    // Yes, we really want the await in the loop. We're deleting 500 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    messages = await getLastMessagesByConversation(conversationId, 500, false);
    if (!messages.length) {
      return;
    }

    const ids = messages.map(message => message.id);

    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    // eslint-disable-next-line no-await-in-loop

    await Promise.all(messages.map(message => message.cleanup()));

    // eslint-disable-next-line no-await-in-loop
    await channels.removeMessage(ids);
  } while (messages.length > 0);
}

export async function trimMessages(): Promise<void> {
  await channels.trimMessages(1000);
  return;
}

export async function getMessagesBySentAt(sentAt: number): Promise<MessageCollection> {
  const messages = await channels.getMessagesBySentAt(sentAt);
  return new MessageCollection(messages);
}

export async function getExpiredMessages(): Promise<MessageCollection> {
  const messages = await channels.getExpiredMessages();
  return new MessageCollection(messages);
}

export async function getOutgoingWithoutExpiresAt(): Promise<MessageCollection> {
  const messages = await channels.getOutgoingWithoutExpiresAt();
  return new MessageCollection(messages);
}

export async function getNextExpiringMessage(): Promise<MessageCollection> {
  const messages = await channels.getNextExpiringMessage();
  return new MessageCollection(messages);
}

// Unprocessed

export async function getUnprocessedCount(): Promise<number> {
  return channels.getUnprocessedCount();
}

export async function getAllUnprocessed(): Promise<Array<UnprocessedParameter>> {
  return channels.getAllUnprocessed();
}

export async function getUnprocessedById(id: string): Promise<UnprocessedParameter | undefined> {
  return channels.getUnprocessedById(id);
}

export type UnprocessedParameter = {
  id: string;
  version: number;
  envelope: string;
  timestamp: number;
  attempts: number;
  messageHash: string;
  senderIdentity?: string;
  decrypted?: string; // added once the envelopes's content is decrypted with updateCache
  source?: string; // added once the envelopes's content is decrypted with updateCache
};

export async function saveUnprocessed(data: UnprocessedParameter): Promise<string> {
  const id = await channels.saveUnprocessed(_cleanData(data));
  return id;
}

export async function updateUnprocessedAttempts(id: string, attempts: number): Promise<void> {
  await channels.updateUnprocessedAttempts(id, attempts);
}
export async function updateUnprocessedWithData(id: string, data: any): Promise<void> {
  await channels.updateUnprocessedWithData(id, data);
}

export async function removeUnprocessed(id: string): Promise<void> {
  await channels.removeUnprocessed(id);
}

export async function removeAllUnprocessed(): Promise<void> {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

export async function getNextAttachmentDownloadJobs(limit: number): Promise<any> {
  return channels.getNextAttachmentDownloadJobs(limit);
}
export async function saveAttachmentDownloadJob(job: any): Promise<void> {
  await channels.saveAttachmentDownloadJob(job);
}
export async function setAttachmentDownloadJobPending(id: string, pending: boolean): Promise<void> {
  await channels.setAttachmentDownloadJobPending(id, pending ? 1 : 0);
}
export async function resetAttachmentDownloadPending(): Promise<void> {
  await channels.resetAttachmentDownloadPending();
}
export async function removeAttachmentDownloadJob(id: string): Promise<void> {
  await channels.removeAttachmentDownloadJob(id);
}
export async function removeAllAttachmentDownloadJobs(): Promise<void> {
  await channels.removeAllAttachmentDownloadJobs();
}

// Other

export async function removeAll(): Promise<void> {
  await channels.removeAll();
}

export async function removeAllConversations(): Promise<void> {
  await channels.removeAllConversations();
}

export async function cleanupOrphanedAttachments(): Promise<void> {
  await callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

// Note: will need to restart the app after calling this, to set up afresh
export async function removeOtherData(): Promise<void> {
  await Promise.all([callChannel(ERASE_SQL_KEY), callChannel(ERASE_ATTACHMENTS_KEY)]);
}

async function callChannel(name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ipcRenderer.send(name);
    ipcRenderer.once(`${name}-done`, (_event, error) => {
      if (error) {
        return reject(error);
      }

      return resolve(undefined);
    });

    setTimeout(
      () => reject(new Error(`callChannel call to ${name} timed out`)),
      DATABASE_UPDATE_TIMEOUT
    );
  });
}

// Functions below here return plain JSON instead of Backbone Models

export async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  options?: { limit: number }
): Promise<Array<MessageAttributes>> {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit: options?.limit,
  });
}

export async function getMessagesWithFileAttachments(
  conversationId: string,
  options?: { limit: number }
): Promise<Array<MessageAttributes>> {
  return channels.getMessagesWithFileAttachments(conversationId, {
    limit: options?.limit,
  });
}

export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';

export async function getSnodePoolFromDb(): Promise<Array<Snode> | null> {
  // this is currently all stored as a big string as we don't really need to do anything with them (no filtering or anything)
  // everything is made in memory and written to disk
  const snodesJson = await exports.getItemById(SNODE_POOL_ITEM_ID);
  if (!snodesJson || !snodesJson.value) {
    return null;
  }

  return JSON.parse(snodesJson.value);
}

export async function updateSnodePoolOnDb(snodesAsJsonString: string): Promise<void> {
  await exports.createOrUpdateItem({ id: SNODE_POOL_ITEM_ID, value: snodesAsJsonString });
}

/** Returns the number of message left to remove (opengroupv1) */
export async function removeOneOpenGroupV1Message(): Promise<number> {
  return channels.removeOneOpenGroupV1Message();
}

/**
 * Generates fake conversations and distributes messages amongst the conversations randomly
 * @param numConvosToAdd Amount of fake conversations to generate
 * @param numMsgsToAdd Number of fake messages to generate
 */
export async function fillWithTestData(convs: number, msgs: number) {
  const newConvos = [];
  for (let convsAddedCount = 0; convsAddedCount < convs; convsAddedCount++) {
    const convoId = `${Date.now()} + ${convsAddedCount}`;
    const newConvo = await getConversationController().getOrCreateAndWait(
      convoId,
      ConversationTypeEnum.PRIVATE
    );
    newConvos.push(newConvo);
  }

  for (let msgsAddedCount = 0; msgsAddedCount < msgs; msgsAddedCount++) {
    // tslint:disable: insecure-random
    const convoToChoose = newConvos[Math.floor(Math.random() * newConvos.length)];
    const direction = Math.random() > 0.5 ? 'outgoing' : 'incoming';
    const body = `spongebob ${new Date().toString()}`;
    if (direction === 'outgoing') {
      await convoToChoose.addSingleOutgoingMessage({
        body,
      });
    } else {
      await convoToChoose.addSingleIncomingMessage({
        source: convoToChoose.id,
        body,
      });
    }
  }
}
