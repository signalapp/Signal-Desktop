import Electron from 'electron';

const { ipcRenderer } = Electron;
// tslint:disable: function-name no-require-imports no-var-requires one-variable-per-declaration no-void-expression

import _ from 'lodash';
import { ConversationCollection, ConversationModel } from '../models/conversation';
import { MessageCollection, MessageModel } from '../models/message';
import { MessageAttributes } from '../models/messageType';
import { HexKeyPair } from '../receiver/keypairs';
import { getSodium } from '../session/crypto';
import { PubKey } from '../session/types';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';
import { ConversationType } from '../state/ducks/conversations';
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

export type SwarmNode = {
  address: string;
  ip: string;
  port: string;
  pubkey_ed25519: string;
  pubkey_x25519: string;
};

export type ServerToken = {
  serverUrl: string;
  token: string;
};

export const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';

const channelsToMake = {
  shutdown,
  close,
  removeDB,
  getPasswordHash,

  getIdentityKeyById,
  removeAllPreKeys,
  removeAllSignedPreKeys,
  removeAllContactPreKeys,
  removeAllContactSignedPreKeys,

  getGuardNodes,
  updateGuardNodes,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  removeItemById,

  removeAllSessions,

  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,

  saveConversation,
  getConversationById,
  updateConversation,
  removeConversation,

  getAllConversations,
  getAllConversationIds,
  getAllOpenGroupV1Conversations,
  getPubkeysInPublicConversation,
  savePublicServerToken,
  getPublicServerTokenByServerUrl,
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

  removeAllMessagesInConversation,

  getMessageBySender,
  getMessageIdsFromServerIds,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,
  getSeenMessagesByHashList,
  getLastHashBySnode,

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
  isKeyPairAlreadySaved,
  removeAllClosedGroupEncryptionKeyPairs,

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

  ipcRenderer.on(`${SQL_CHANNEL_KEY}-done`, (event, jobId, errorForDisplay, result) => {
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

// When IPC arguments are prepared for the cross-process send, they are JSON.stringified.
// We can't send ArrayBuffers or BigNumbers (what we get from proto library for dates).
function _cleanData(data: any): any {
  const keys = Object.keys(data);
  for (let index = 0, max = keys.length; index < max; index += 1) {
    const key = keys[index];
    const value = data[key];

    if (value === null || value === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (_.isFunction(value.toNumber)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.toNumber();
    } else if (Array.isArray(value)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.map(_cleanData);
    } else if (_.isObject(value)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = _cleanData(value);
    } else if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      window.log.info(`_cleanData: key ${key} had type ${typeof value}`);
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
  window.log.info(`data.shutdown: starting process. ${jobKeys.length} jobs outstanding`);

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0) {
    return null;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise((resolve, reject) => {
    _shutdownCallback = (error: any) => {
      window.log.info('data.shutdown: process complete');
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
    window.log.debug(`SQL channel job ${id} (${fnName}) started`);
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
      // const end = Date.now();
      // const delta = end - start;
      // if (delta > 10) {
      //   window.log.debug(
      //     `SQL channel job ${id} (${fnName}) succeeded in ${end - start}ms`
      //   );
      // }
      return resolve(value);
    },
    reject: (error: any) => {
      _removeJob(id);
      const end = Date.now();
      window.log.warn(`SQL channel job ${id} (${fnName}) failed in ${end - start}ms`);
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
    clearTimeout(_jobs[id].timer);
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

// Identity Keys

const IDENTITY_KEY_KEYS = ['publicKey'];

// Identity Keys
// TODO: identity key has different shape depending on how it is called,
// so we need to come up with a way to make TS work with all of them

export async function getIdentityKeyById(id: string): Promise<IdentityKey | null> {
  const data = await channels.getIdentityKeyById(id);
  return keysToArrayBuffer(IDENTITY_KEY_KEYS, data);
}

// Those removeAll are not used anymore except to cleanup the app since we removed all of those tables
export async function removeAllPreKeys(): Promise<void> {
  await channels.removeAllPreKeys();
}
const PRE_KEY_KEYS = ['privateKey', 'publicKey', 'signature'];
export async function removeAllSignedPreKeys(): Promise<void> {
  await channels.removeAllSignedPreKeys();
}
export async function removeAllContactPreKeys(): Promise<void> {
  await channels.removeAllContactPreKeys();
}
export async function removeAllContactSignedPreKeys(): Promise<void> {
  await channels.removeAllContactSignedPreKeys();
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
// Sessions
export async function removeAllSessions(): Promise<void> {
  await channels.removeAllSessions();
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

export async function isKeyPairAlreadySaved(
  groupPublicKey: string,
  keypair: HexKeyPair
): Promise<boolean> {
  return channels.isKeyPairAlreadySaved(groupPublicKey, keypair);
}

export async function removeAllClosedGroupEncryptionKeyPairs(
  groupPublicKey: string
): Promise<void> {
  return channels.removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
}

// Conversation
export async function saveConversation(data: ConversationType): Promise<void> {
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

export async function updateConversation(data: ConversationType): Promise<void> {
  await channels.updateConversation(data);
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

export async function getAllConversationIds(): Promise<Array<string>> {
  const ids = await channels.getAllConversationIds();
  return ids;
}

export async function getAllOpenGroupV1Conversations(): Promise<ConversationCollection> {
  const conversations = await channels.getAllOpenGroupV1Conversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

export async function getPubkeysInPublicConversation(id: string): Promise<Array<string>> {
  return channels.getPubkeysInPublicConversation(id);
}

// open groups v1 only
export async function savePublicServerToken(data: ServerToken): Promise<void> {
  await channels.savePublicServerToken(data);
}

// open groups v1 only
export async function getPublicServerTokenByServerUrl(serverUrl: string): Promise<string> {
  const token = await channels.getPublicServerTokenByServerUrl(serverUrl);
  return token;
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

export async function searchMessages(query: string, { limit }: any = {}): Promise<Array<any>> {
  const messages = await channels.searchMessages(query, { limit });
  return messages;
}

/**
 * Returns just json objects not MessageModel
 */
export async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  options: { limit: number } | undefined
): Promise<Object> {
  const messages = await channels.searchMessagesInConversation(query, conversationId, {
    limit: options?.limit,
  });
  return messages;
}

// Message

export async function cleanSeenMessages(): Promise<void> {
  await channels.cleanSeenMessages();
}

export async function cleanLastHashes(): Promise<void> {
  await channels.cleanLastHashes();
}

// TODO: Strictly type the following
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
  const id = await channels.saveMessage(_cleanData(data));
  window.Whisper.ExpiringMessagesListener.update();
  return id;
}

export async function saveMessages(arrayOfMessages: Array<MessageAttributes>): Promise<void> {
  await channels.saveMessages(_cleanData(arrayOfMessages));
}

export async function removeMessage(id: string): Promise<void> {
  const message = await getMessageById(id);

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

export async function getMessageIdsFromServerIds(serverIds: Array<string>, conversationId: string) {
  return channels.getMessageIdsFromServerIds(serverIds, conversationId);
}

export async function getMessageById(id: string): Promise<MessageModel | null> {
  const message = await channels.getMessageById(id);
  if (!message) {
    return null;
  }

  return new MessageModel(message);
}

// For testing only
export async function getAllMessages(): Promise<MessageCollection> {
  const messages = await channels.getAllMessages();
  return new MessageCollection(messages);
}

export async function getAllMessageIds(): Promise<Array<string>> {
  const ids = await channels.getAllMessageIds();
  return ids;
}

export async function getMessageBySender(
  // eslint-disable-next-line camelcase
  { source, sourceDevice, sent_at }: { source: string; sourceDevice: number; sent_at: number }
): Promise<MessageModel | null> {
  const messages = await channels.getMessageBySender({
    source,
    sourceDevice,
    sent_at,
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

export async function getMessagesByConversation(
  conversationId: string,
  { limit = 100, receivedAt = Number.MAX_VALUE, type = '%' }
): Promise<MessageCollection> {
  const messages = await channels.getMessagesByConversation(conversationId, {
    limit,
    receivedAt,
    type,
  });
  return new MessageCollection(messages);
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
    // Yes, we really want the await in the loop. We're deleting 100 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    messages = await getMessagesByConversation(conversationId, {
      limit: 100,
    });

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

export async function getAllUnprocessed(): Promise<any> {
  return channels.getAllUnprocessed();
}

export async function getUnprocessedById(id: string): Promise<any> {
  return channels.getUnprocessedById(id);
}

export type UnprocessedParameter = {
  id: string;
  version: number;
  envelope: string;
  timestamp: number;
  attempts: number;
  senderIdentity?: string;
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
  await channels.setAttachmentDownloadJobPending(id, pending);
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
    ipcRenderer.once(`${name}-done`, (event, error) => {
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
): Promise<any> {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit: options?.limit,
  });
}

export async function getMessagesWithFileAttachments(
  conversationId: string,
  options?: { limit: number }
): Promise<any> {
  return channels.getMessagesWithFileAttachments(conversationId, {
    limit: options?.limit,
  });
}
