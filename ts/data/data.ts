// eslint:disable: no-require-imports no-var-requires one-variable-per-declaration no-void-expression function-name

import _, { isEmpty } from 'lodash';
import { ConversationModel } from '../models/conversation';
import { ConversationAttributes } from '../models/conversationAttributes';
import { MessageCollection, MessageModel } from '../models/message';
import { MessageAttributes, MessageDirection } from '../models/messageType';
import { StorageItem } from '../node/storage_item';
import { HexKeyPair } from '../receiver/keypairs';
import { Quote } from '../receiver/types';
import { getSodiumRenderer } from '../session/crypto';
import { DisappearingMessages } from '../session/disappearing_messages';
import { PubKey } from '../session/types';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';
import { MessageResultProps } from '../types/message';
import {
  AsyncWrapper,
  MsgDuplicateSearchOpenGroup,
  SaveConversationReturn,
  UnprocessedDataNode,
  UpdateLastHashType,
} from '../types/sqlSharedTypes';
import { Storage } from '../util/storage';
import { channels } from './channels';
import * as dataInit from './dataInit';
import { cleanData } from './dataUtils';
import { SNODE_POOL_ITEM_ID } from './settings-key';
import { GuardNode, Snode } from './types';

const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

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

async function clearOutAllSnodesNotInPool(edKeysOfSnodePool: Array<string>): Promise<void> {
  await channels.clearOutAllSnodesNotInPool(edKeysOfSnodePool);
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
async function saveConversation(data: ConversationAttributes): Promise<SaveConversationReturn> {
  const cleaned = cleanData(data) as ConversationAttributes;
  /**
   * Merging two conversations in `handleMessageRequestResponse` introduced a bug where we would mark conversation active_at to be -Infinity.
   * The root issue has been fixed, but just to make sure those INVALID DATE does not show up, update those -Infinity active_at conversations to be now(), once.,
   */
  if (cleaned.active_at === -Infinity) {
    cleaned.active_at = Date.now();
  }

  return channels.saveConversation(cleaned);
}

async function fetchConvoMemoryDetails(convoId: string): Promise<SaveConversationReturn> {
  return channels.fetchConvoMemoryDetails(convoId);
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

async function getAllConversations(): Promise<Array<ConversationModel>> {
  const conversationsAttrs =
    (await channels.getAllConversations()) as Array<ConversationAttributes>;

  return conversationsAttrs.map(attr => new ConversationModel(attr));
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
  await channels.saveSeenMessageHashes(cleanData(data));
}

async function updateLastHash(data: UpdateLastHashType): Promise<void> {
  await channels.updateLastHash(cleanData(data));
}

async function saveMessage(data: MessageAttributes): Promise<string> {
  const cleanedData = cleanData(data);
  const id = await channels.saveMessage(cleanedData);
  DisappearingMessages.updateExpiringMessagesCheck();
  return id;
}

async function saveMessages(arrayOfMessages: Array<MessageAttributes>): Promise<void> {
  await channels.saveMessages(cleanData(arrayOfMessages));
}

/**
 *
 * @param conversationId the conversation from which to remove all but the most recent disappear timer update
 * @param isPrivate if that conversation is private, we keep a expiration timer update for each sender
 * @returns the array of messageIds removed, or [] if none were removed
 */
async function cleanUpExpirationTimerUpdateHistory(
  conversationId: string,
  isPrivate: boolean
): Promise<Array<string>> {
  return channels.cleanUpExpirationTimerUpdateHistory(conversationId, isPrivate);
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

async function getMessagesById(ids: Array<string>): Promise<Array<MessageModel>> {
  const messages = await channels.getMessagesById(ids);
  if (!messages || isEmpty(messages)) {
    return [];
  }
  return messages.map((msg: any) => new MessageModel(msg));
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
 * Fetch all messages that match the sender pubkey and sent_at timestamp
 * @param propsList An array of objects containing a source (the sender id) and timestamp of the message - not to be confused with the serverTimestamp. This is equivalent to sent_at
 * @returns the fetched messageModels
 */
async function getMessagesBySenderAndSentAt(
  propsList: Array<{
    source: string;
    timestamp: number;
  }>
): Promise<MessageCollection | null> {
  const messages = await channels.getMessagesBySenderAndSentAt(propsList);

  if (!messages || !messages.length) {
    return null;
  }

  return new MessageCollection(messages);
}

async function getUnreadByConversation(
  conversationId: string,
  sentBeforeTimestamp: number
): Promise<MessageCollection> {
  const messages = await channels.getUnreadByConversation(conversationId, sentBeforeTimestamp);
  return new MessageCollection(messages);
}

async function getUnreadDisappearingByConversation(
  conversationId: string,
  sentBeforeTimestamp: number
): Promise<Array<MessageModel>> {
  const messages = await channels.getUnreadDisappearingByConversation(
    conversationId,
    sentBeforeTimestamp
  );
  return new MessageCollection(messages).models;
}

async function markAllAsReadByConversationNoExpiration(
  conversationId: string,
  returnMessagesUpdated: boolean // for performance reason we do not return them because usually they are not needed
): Promise<Array<number>> {
  const messagesIds = await channels.markAllAsReadByConversationNoExpiration(
    conversationId,
    returnMessagesUpdated
  );
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
  {
    skipTimerInit = false,
    returnQuotes = false,
    messageId = null,
  }: { skipTimerInit?: false; returnQuotes?: boolean; messageId: string | null }
): Promise<{ messages: MessageCollection; quotes: Array<Quote> }> {
  const { messages, quotes } = await channels.getMessagesByConversation(conversationId, {
    messageId,
    returnQuotes,
  });

  if (skipTimerInit) {
    // eslint-disable-next-line no-restricted-syntax
    for (const message of messages) {
      message.skipTimerInit = skipTimerInit;
    }
  }

  return {
    messages: new MessageCollection(messages),
    quotes,
  };
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
    // eslint-disable-next-line no-restricted-syntax
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
  // eslint-disable-next-line no-restricted-syntax
  for (const message of messages) {
    message.skipTimerInit = true;
  }

  const collection = new MessageCollection(messages);
  return collection.length ? collection.models[0] : null;
}

async function getOldestMessageInConversation(conversationId: string) {
  const messages = await channels.getOldestMessageInConversation(conversationId);
  // eslint-disable-next-line no-restricted-syntax
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
  conversationId: string
): Promise<string | undefined> {
  return channels.getFirstUnreadMessageWithMention(conversationId);
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
  const startFunction = Date.now();
  let start = Date.now();

  let messages;
  do {
    // Yes, we really want the await in the loop. We're deleting 500 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    messages = await getLastMessagesByConversation(conversationId, 1000, false);
    if (!messages.length) {
      return;
    }
    window.log.info(
      `removeAllMessagesInConversation getLastMessagesByConversation ${conversationId} ${
        messages.length
      } took ${Date.now() - start}ms`
    );

    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    const ids = messages.map(message => message.id);
    start = Date.now();
    for (let index = 0; index < messages.length; index++) {
      const message = messages.at(index);
      // eslint-disable-next-line no-await-in-loop
      await message.cleanup();
    }
    window.log.info(
      `removeAllMessagesInConversation messages.cleanup() ${conversationId} took ${
        Date.now() - start
      }ms`
    );
    start = Date.now();

    // eslint-disable-next-line no-await-in-loop
    await channels.removeMessagesByIds(ids);
    window.log.info(
      `removeAllMessagesInConversation: removeMessagesByIds ${conversationId} took ${
        Date.now() - start
      }ms`
    );
  } while (messages.length);

  await channels.removeAllMessagesInConversation(conversationId);
  window.log.info(
    `removeAllMessagesInConversation: complete time ${conversationId} took ${
      Date.now() - startFunction
    }ms`
  );
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

const getUnprocessedCount: AsyncWrapper<UnprocessedDataNode['getUnprocessedCount']> = () => {
  return channels.getUnprocessedCount();
};

const getAllUnprocessed: AsyncWrapper<UnprocessedDataNode['getAllUnprocessed']> = () => {
  return channels.getAllUnprocessed();
};

const getUnprocessedById: AsyncWrapper<UnprocessedDataNode['getUnprocessedById']> = id => {
  return channels.getUnprocessedById(id);
};

const saveUnprocessed: AsyncWrapper<UnprocessedDataNode['saveUnprocessed']> = data => {
  return channels.saveUnprocessed(cleanData(data));
};

const updateUnprocessedAttempts: AsyncWrapper<UnprocessedDataNode['updateUnprocessedAttempts']> = (
  id,
  attempts
) => {
  return channels.updateUnprocessedAttempts(id, attempts);
};
const updateUnprocessedWithData: AsyncWrapper<UnprocessedDataNode['updateUnprocessedWithData']> = (
  id,
  data
) => {
  return channels.updateUnprocessedWithData(id, cleanData(data));
};

const removeUnprocessed: AsyncWrapper<UnprocessedDataNode['removeUnprocessed']> = id => {
  return channels.removeUnprocessed(id);
};

const removeAllUnprocessed: AsyncWrapper<UnprocessedDataNode['removeAllUnprocessed']> = () => {
  return channels.removeAllUnprocessed();
};

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
  await Storage.put(SNODE_POOL_ITEM_ID, snodesAsJsonString);
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

const ITEM_KEYS: object = {
  identityKey: ['value.pubKey', 'value.privKey'],
  profileKey: ['value'],
};

/**
 * For anything related to the UI and redux, do not use `createOrUpdateItem` directly. Instead use Storage.put (from the utils folder).
 * `Storage.put` will update the settings redux slice if needed but createOrUpdateItem will not.
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
  clearOutAllSnodesNotInPool,
  getAllEncryptionKeyPairsForGroup,
  getLatestClosedGroupEncryptionKeyPair,
  addClosedGroupEncryptionKeyPair,
  removeAllClosedGroupEncryptionKeyPairs,
  saveConversation,
  fetchConvoMemoryDetails,
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
  cleanUpExpirationTimerUpdateHistory,
  getMessageIdsFromServerIds,
  getMessageById,
  getMessagesById,
  getMessagesBySenderAndSentAt,
  getMessageByServerId,
  filterAlreadyFetchedOpengroupMessage,
  getUnreadByConversation,
  getUnreadDisappearingByConversation,
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

  // Unprocessed messages data
  getUnprocessedCount,
  getAllUnprocessed,
  getUnprocessedById,
  saveUnprocessed,
  updateUnprocessedAttempts,
  updateUnprocessedWithData,
  removeUnprocessed,
  removeAllUnprocessed,

  // attachments download jobs
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
};
