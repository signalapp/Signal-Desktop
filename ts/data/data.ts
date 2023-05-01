// tslint:disable: no-require-imports no-var-requires one-variable-per-declaration no-void-expression
// tslint:disable: function-name

import _ from 'lodash';
import { MessageResultProps } from '../components/search/MessageSearchResults';
import { ConversationCollection, ConversationModel } from '../models/conversation';
import { ConversationAttributes, ConversationTypeEnum } from '../models/conversationAttributes';
import { MessageCollection, MessageModel } from '../models/message';
import { MessageAttributes, MessageDirection } from '../models/messageType';
import { HexKeyPair } from '../receiver/keypairs';
import { getConversationController } from '../session/conversations';
import { getSodiumRenderer } from '../session/crypto';
import { PubKey } from '../session/types';
import { MsgDuplicateSearchOpenGroup, UpdateLastHashType } from '../types/sqlSharedTypes';
import { ExpirationTimerOptions } from '../util/expiringMessages';
import { Storage } from '../util/storage';
import { channels } from './channels';
import * as dataInit from './dataInit';
import { StorageItem } from '../node/storage_item';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';

const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

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

export const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
export const lastAvatarUploadTimestamp = 'lastAvatarUploadTimestamp';
export const hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';

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
    } else if (_.isObject(value) && value instanceof ArrayBuffer) {
      window.log.error(
        'Trying to save an ArrayBuffer to the db is most likely an error. This specific field should be removed before the cleanData call'
      );
      /// just skip it
      continue;
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

// we export them like this instead of directly with the `export function` cause this is helping a lot for testing
export const Data = {
  shutdown,
  close,
  removeDB,
  getPasswordHash,

  // items table logic
  createOrUpdateItem,
  getItemById,
  getAllItems,
  removeItemById,

  // guard nodes
  getGuardNodes,
  updateGuardNodes,
  generateAttachmentKeyIfEmpty,
  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,
  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  addClosedGroupEncryptionKeyPair,
  removeAllClosedGroupEncryptionKeyPairs,
  saveConversation,
  getConversationById,
  removeConversation,
  getAllConversations,
  getPubkeysInPublicConversation,
  searchConversations,
  searchMessages,
  searchMessagesInConversation,
  cleanSeenMessages,
  cleanLastHashes,
  saveSeenMessageHashes,
  updateLastHash,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessagesByIds,
  getMessageIdsFromServerIds,
  getMessageById,
  getMessageByServerId,
  filterAlreadyFetchedOpengroupMessage,
  getMessageBySenderAndTimestamp,
  getUnreadByConversation,
  getUnreadCountByConversation,
  markAllAsReadByConversationNoExpiration,
  getMessageCountByType,
  getMessagesByConversation,
  getLastMessagesByConversation,
  getLastMessageIdInConversation,
  getLastMessageInConversation,
  getOldestMessageInConversation,
  getMessageCount,
  getFirstUnreadMessageIdInConversation,
  getFirstUnreadMessageWithMention,
  hasConversationOutgoingMessage,
  getLastHashBySnode,
  getSeenMessagesByHashList,
  removeAllMessagesInConversation,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
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
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,
  removeAll,
  removeAllConversations,
  cleanupOrphanedAttachments,
  removeOtherData,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getSnodePoolFromDb,
  updateSnodePoolOnDb,
  fillWithTestData,
};

// Basic
async function shutdown(): Promise<void> {
  // Stop accepting new SQL jobs, flush outstanding queue
  await dataInit.shutdown();
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

// Password hash

async function getPasswordHash(): Promise<string | null> {
  return channels.getPasswordHash();
}

// Guard Nodes
async function getGuardNodes(): Promise<Array<GuardNode>> {
  return channels.getGuardNodes();
}
async function updateGuardNodes(nodes: Array<string>): Promise<void> {
  return channels.updateGuardNodes(nodes);
}

async function generateAttachmentKeyIfEmpty() {
  const existingKey = await getItemById('local_attachment_encrypted_key');
  if (!existingKey) {
    const sodium = await getSodiumRenderer();
    const encryptingKey = sodium.to_hex(sodium.randombytes_buf(32));
    await createOrUpdateItem({
      id: 'local_attachment_encrypted_key',
      value: encryptingKey,
    });
    // be sure to write the new key to the cache. so we can access it straight away
    await Storage.put('local_attachment_encrypted_key', encryptingKey);
  }
}

// Swarm nodes
async function getSwarmNodesForPubkey(pubkey: string): Promise<Array<string>> {
  return channels.getSwarmNodesForPubkey(pubkey);
}

async function updateSwarmNodesForPubkey(
  pubkey: string,
  snodeEdKeys: Array<string>
): Promise<void> {
  await channels.updateSwarmNodesForPubkey(pubkey, snodeEdKeys);
}

// Closed group

/**
 * The returned array is ordered based on the timestamp, the latest is at the end.
 */
async function getAllEncryptionKeyPairsForGroup(
  groupPublicKey: string | PubKey
): Promise<Array<HexKeyPair> | undefined> {
  const pubkey = (groupPublicKey as PubKey).key || (groupPublicKey as string);
  return channels.getAllEncryptionKeyPairsForGroup(pubkey);
}

async function getLatestClosedGroupEncryptionKeyPair(
  groupPublicKey: string
): Promise<HexKeyPair | undefined> {
  return channels.getLatestClosedGroupEncryptionKeyPair(groupPublicKey);
}

async function addClosedGroupEncryptionKeyPair(
  groupPublicKey: string,
  keypair: HexKeyPair
): Promise<void> {
  await channels.addClosedGroupEncryptionKeyPair(groupPublicKey, keypair);
}

async function removeAllClosedGroupEncryptionKeyPairs(groupPublicKey: string): Promise<void> {
  return channels.removeAllClosedGroupEncryptionKeyPairs(groupPublicKey);
}

// Conversation
async function saveConversation(data: ConversationAttributes): Promise<void> {
  const cleaned = _cleanData(data);
  /**
   * Merging two conversations in `handleMessageRequestResponse` introduced a bug where we would mark conversation active_at to be -Infinity.
   * The root issue has been fixed, but just to make sure those INVALID DATE does not show up, update those -Infinity active_at conversations to be now(), once.,
   */
  if (cleaned.active_at === -Infinity) {
    cleaned.active_at = Date.now();
  }
  await channels.saveConversation(cleaned);
}

async function getConversationById(id: string): Promise<ConversationModel | undefined> {
  const data = await channels.getConversationById(id);
  if (data) {
    return new ConversationModel(data);
  }
  return undefined;
}

async function removeConversation(id: string): Promise<void> {
  const existing = await getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await existing.cleanup();
  }
}

async function getAllConversations(): Promise<ConversationCollection> {
  const conversations = await channels.getAllConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

/**
 * This returns at most MAX_PUBKEYS_MEMBERS members, the last MAX_PUBKEYS_MEMBERS members who wrote in the chat
 */
async function getPubkeysInPublicConversation(id: string): Promise<Array<string>> {
  return channels.getPubkeysInPublicConversation(id);
}

async function searchConversations(query: string): Promise<Array<any>> {
  const conversations = await channels.searchConversations(query);
  return conversations;
}

async function searchMessages(query: string, limit: number): Promise<Array<MessageResultProps>> {
  const messages = (await channels.searchMessages(query, limit)) as Array<MessageResultProps>;
  return _.uniqWith(messages, (left: { id: string }, right: { id: string }) => {
    return left.id === right.id;
  });
}

/**
 * Returns just json objects not MessageModel
 */
async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  limit: number
): Promise<Array<MessageAttributes>> {
  const messages = (await channels.searchMessagesInConversation(
    query,
    conversationId,
    limit
  )) as Array<MessageAttributes>;
  return messages;
}

// Message

async function cleanSeenMessages(): Promise<void> {
  await channels.cleanSeenMessages();
}

async function cleanLastHashes(): Promise<void> {
  await channels.cleanLastHashes();
}

async function saveSeenMessageHashes(
  data: Array<{
    expiresAt: number;
    hash: string;
  }>
): Promise<void> {
  await channels.saveSeenMessageHashes(_cleanData(data));
}

async function updateLastHash(data: UpdateLastHashType): Promise<void> {
  await channels.updateLastHash(_cleanData(data));
}

async function saveMessage(data: MessageAttributes): Promise<string> {
  const cleanedData = _cleanData(data);
  const id = await channels.saveMessage(cleanedData);
  ExpirationTimerOptions.updateExpiringMessagesCheck();
  return id;
}

async function saveMessages(arrayOfMessages: Array<MessageAttributes>): Promise<void> {
  await channels.saveMessages(_cleanData(arrayOfMessages));
}

async function removeMessage(id: string): Promise<void> {
  const message = await getMessageById(id, true);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await message.cleanup();
  }
}

/**
 * Note: this method will not clean up external files, just delete from SQL.
 * Files are cleaned up on app start if they are not linked to any messages
 *
 */
async function removeMessagesByIds(ids: Array<string>): Promise<void> {
  await channels.removeMessagesByIds(ids);
}

async function getMessageIdsFromServerIds(
  serverIds: Array<string> | Array<number>,
  conversationId: string
): Promise<Array<string> | undefined> {
  return channels.getMessageIdsFromServerIds(serverIds, conversationId);
}

async function getMessageById(
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

async function getMessageByServerId(
  conversationId: string,
  serverId: number,
  skipTimerInit: boolean = false
): Promise<MessageModel | null> {
  const message = await channels.getMessageByServerId(conversationId, serverId);
  if (!message) {
    return null;
  }
  if (skipTimerInit) {
    message.skipTimerInit = skipTimerInit;
  }

  return new MessageModel(message);
}

async function filterAlreadyFetchedOpengroupMessage(
  msgDetails: MsgDuplicateSearchOpenGroup
): Promise<MsgDuplicateSearchOpenGroup> {
  const msgDetailsNotAlreadyThere = await channels.filterAlreadyFetchedOpengroupMessage(msgDetails);
  return msgDetailsNotAlreadyThere || [];
}

/**
 *
 * @param source senders id
 * @param timestamp the timestamp of the message - not to be confused with the serverTimestamp. This is equivalent to sent_at
 */
async function getMessageBySenderAndTimestamp({
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

async function getUnreadByConversation(conversationId: string): Promise<MessageCollection> {
  const messages = await channels.getUnreadByConversation(conversationId);
  return new MessageCollection(messages);
}

async function markAllAsReadByConversationNoExpiration(
  conversationId: string,
  returnMessagesUpdated: boolean // for performance reason we do not return them because usually they are not needed
): Promise<Array<number>> {
  // tslint:disable-next-line: no-console
  console.time('markAllAsReadByConversationNoExpiration');
  const messagesIds = await channels.markAllAsReadByConversationNoExpiration(
    conversationId,
    returnMessagesUpdated
  );
  // tslint:disable-next-line: no-console
  console.timeEnd('markAllAsReadByConversationNoExpiration');
  return messagesIds;
}

// might throw
async function getUnreadCountByConversation(conversationId: string): Promise<number> {
  return channels.getUnreadCountByConversation(conversationId);
}

/**
 * Gets the count of messages for a direction
 * @param conversationId Conversation for messages to retrieve from
 * @param type outgoing/incoming
 */
async function getMessageCountByType(
  conversationId: string,
  type?: MessageDirection
): Promise<number> {
  return channels.getMessageCountByType(conversationId, type);
}

async function getMessagesByConversation(
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
async function getLastMessagesByConversation(
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

async function getLastMessageIdInConversation(conversationId: string) {
  const collection = await getLastMessagesByConversation(conversationId, 1, true);
  return collection.models.length ? collection.models[0].id : null;
}

async function getLastMessageInConversation(conversationId: string) {
  const messages = await channels.getLastMessagesByConversation(conversationId, 1);
  for (const message of messages) {
    message.skipTimerInit = true;
  }

  const collection = new MessageCollection(messages);
  return collection.length ? collection.models[0] : null;
}

async function getOldestMessageInConversation(conversationId: string) {
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
async function getMessageCount() {
  return channels.getMessageCount();
}

async function getFirstUnreadMessageIdInConversation(
  conversationId: string
): Promise<string | undefined> {
  return channels.getFirstUnreadMessageIdInConversation(conversationId);
}

async function getFirstUnreadMessageWithMention(
  conversationId: string,
  ourPubkey: string
): Promise<string | undefined> {
  return channels.getFirstUnreadMessageWithMention(conversationId, ourPubkey);
}

async function hasConversationOutgoingMessage(conversationId: string): Promise<boolean> {
  return channels.hasConversationOutgoingMessage(conversationId);
}
async function getLastHashBySnode(
  convoId: string,
  snode: string,
  namespace: number
): Promise<string> {
  return channels.getLastHashBySnode(convoId, snode, namespace);
}

async function getSeenMessagesByHashList(hashes: Array<string>): Promise<any> {
  return channels.getSeenMessagesByHashList(hashes);
}

async function removeAllMessagesInConversation(conversationId: string): Promise<void> {
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
    await channels.removeMessagesByIds(ids);
  } while (messages.length > 0);
}

async function getMessagesBySentAt(sentAt: number): Promise<MessageCollection> {
  const messages = await channels.getMessagesBySentAt(sentAt);
  return new MessageCollection(messages);
}

async function getExpiredMessages(): Promise<MessageCollection> {
  const messages = await channels.getExpiredMessages();
  return new MessageCollection(messages);
}

async function getOutgoingWithoutExpiresAt(): Promise<MessageCollection> {
  const messages = await channels.getOutgoingWithoutExpiresAt();
  return new MessageCollection(messages);
}

async function getNextExpiringMessage(): Promise<MessageCollection> {
  const messages = await channels.getNextExpiringMessage();
  return new MessageCollection(messages);
}

// Unprocessed

async function getUnprocessedCount(): Promise<number> {
  return channels.getUnprocessedCount();
}

async function getAllUnprocessed(): Promise<Array<UnprocessedParameter>> {
  return channels.getAllUnprocessed();
}

async function getUnprocessedById(id: string): Promise<UnprocessedParameter | undefined> {
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

async function saveUnprocessed(data: UnprocessedParameter): Promise<string> {
  const id = await channels.saveUnprocessed(_cleanData(data));
  return id;
}

async function updateUnprocessedAttempts(id: string, attempts: number): Promise<void> {
  await channels.updateUnprocessedAttempts(id, attempts);
}
async function updateUnprocessedWithData(id: string, data: any): Promise<void> {
  await channels.updateUnprocessedWithData(id, data);
}

async function removeUnprocessed(id: string): Promise<void> {
  await channels.removeUnprocessed(id);
}

async function removeAllUnprocessed(): Promise<void> {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

async function getNextAttachmentDownloadJobs(limit: number): Promise<any> {
  return channels.getNextAttachmentDownloadJobs(limit);
}
async function saveAttachmentDownloadJob(job: any): Promise<void> {
  await channels.saveAttachmentDownloadJob(job);
}
async function setAttachmentDownloadJobPending(id: string, pending: boolean): Promise<void> {
  await channels.setAttachmentDownloadJobPending(id, pending ? 1 : 0);
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

// Other

async function removeAll(): Promise<void> {
  await channels.removeAll();
}

async function removeAllConversations(): Promise<void> {
  await channels.removeAllConversations();
}

async function cleanupOrphanedAttachments(): Promise<void> {
  await dataInit.callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData(): Promise<void> {
  await Promise.all([
    dataInit.callChannel(ERASE_SQL_KEY),
    dataInit.callChannel(ERASE_ATTACHMENTS_KEY),
  ]);
}

// Functions below here return plain JSON instead of Backbone Models

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  limit?: number
): Promise<Array<MessageAttributes>> {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, limit);
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  limit: number
): Promise<Array<MessageAttributes>> {
  return channels.getMessagesWithFileAttachments(conversationId, limit);
}

export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';

async function getSnodePoolFromDb(): Promise<Array<Snode> | null> {
  // this is currently all stored as a big string as we don't really need to do anything with them (no filtering or anything)
  // everything is made in memory and written to disk
  const snodesJson = await Data.getItemById(SNODE_POOL_ITEM_ID);
  if (!snodesJson || !snodesJson.value) {
    return null;
  }

  return JSON.parse(snodesJson.value);
}

async function updateSnodePoolOnDb(snodesAsJsonString: string): Promise<void> {
  await Data.createOrUpdateItem({ id: SNODE_POOL_ITEM_ID, value: snodesAsJsonString });
}

/**
 * Generates fake conversations and distributes messages amongst the conversations randomly
 * @param numConvosToAdd Amount of fake conversations to generate
 * @param numMsgsToAdd Number of fake messages to generate
 */
async function fillWithTestData(convs: number, msgs: number) {
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

function keysToArrayBuffer(keys: any, data: any) {
  const updated = _.cloneDeep(data);
  // tslint:disable: one-variable-per-declaration
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

const ITEM_KEYS: Object = {
  identityKey: ['value.pubKey', 'value.privKey'],
  profileKey: ['value'],
};

/**
 * Note: In the app, you should always call createOrUpdateItem through Data.createOrUpdateItem (from the data.ts file).
 * This is to ensure testing and stubbbing works as expected
 */
export async function createOrUpdateItem(data: StorageItem): Promise<void> {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdateItem: Provided data did not have a truthy id');
  }

  const keys = (ITEM_KEYS as any)[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}

/**
 * Note: In the app, you should always call getItemById through Data.getItemById (from the data.ts file).
 * This is to ensure testing and stubbbing works as expected
 */
export async function getItemById(id: string): Promise<StorageItem | undefined> {
  const keys = (ITEM_KEYS as any)[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}
/**
 * Note: In the app, you should always call getAllItems through Data.getAllItems (from the data.ts file).
 * This is to ensure testing and stubbbing works as expected
 */
export async function getAllItems(): Promise<Array<StorageItem>> {
  const items = await channels.getAllItems();
  return _.map(items, item => {
    const { id } = item;
    const keys = (ITEM_KEYS as any)[id];
    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}

/**
 * Note: In the app, you should always call removeItemById through Data.removeItemById (from the data.ts file).
 * This is to ensure testing and stubbbing works as expected
 */
export async function removeItemById(id: string): Promise<void> {
  await channels.removeItemById(id);
}
