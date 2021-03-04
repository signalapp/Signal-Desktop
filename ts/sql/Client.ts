// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-await-in-loop */
/* eslint-disable camelcase */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { ipcRenderer } from 'electron';

import { cloneDeep, get, groupBy, last, map, omit, set } from 'lodash';

import { arrayBufferToBase64, base64ToArrayBuffer } from '../Crypto';
import { CURRENT_SCHEMA_VERSION } from '../../js/modules/types/message';
import { createBatcher } from '../util/batcher';
import { assert } from '../util/assert';
import { cleanDataForIpc } from './cleanDataForIpc';

import {
  ConversationModelCollectionType,
  MessageModelCollectionType,
} from '../model-types.d';

import {
  AttachmentDownloadJobType,
  ClientInterface,
  ConversationType,
  IdentityKeyType,
  ItemType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyType,
  SearchResultMessageType,
  SessionType,
  SignedPreKeyType,
  StickerPackStatusType,
  StickerPackType,
  StickerType,
  UnprocessedType,
} from './Interface';
import Server from './Server';
import { MessageModel } from '../models/messages';
import { ConversationModel } from '../models/conversations';
import { waitForPendingQueries } from './Queueing';

// We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
//   any warnings that might be sent to the console in that case.
if (ipcRenderer && ipcRenderer.setMaxListeners) {
  ipcRenderer.setMaxListeners(0);
} else {
  window.log.warn('sql/Client: ipcRenderer is not available!');
}

const DATABASE_UPDATE_TIMEOUT = 2 * 60 * 1000; // two minutes

const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';
const ENSURE_FILE_PERMISSIONS = 'ensure-file-permissions';

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
  getAllSignedPreKeys,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  createOrUpdateSessions,
  getSessionById,
  getSessionsById,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByConversation,
  removeAllSessions,
  getAllSessions,

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,

  eraseStorageServiceStateFromConversations,
  getAllConversations,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  getUnreadByConversation,

  getMessageBySender,
  getMessageById,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getNextTapToViewMessageToAgeOut,
  getTapToViewMessagesNeedingErase,
  getOlderMessagesByConversation,
  getNewerMessagesByConversation,
  getLastConversationActivity,
  getLastConversationPreview,
  getMessageMetricsForConversation,
  hasGroupCallHistoryMessage,
  migrateConversationMessages,

  getUnprocessedCount,
  getAllUnprocessed,
  getUnprocessedById,
  saveUnprocessed,
  saveUnprocesseds,
  updateUnprocessedAttempts,
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

  getStickerCount,
  createOrUpdateStickerPack,
  updateStickerPackStatus,
  createOrUpdateSticker,
  updateStickerLastUsed,
  addStickerPackReference,
  deleteStickerPackReference,
  deleteStickerPack,
  getAllStickerPacks,
  getAllStickers,
  getRecentStickers,
  clearAllErrorStickerPackAttempts,

  updateEmojiUsage,
  getRecentEmojis,

  removeAll,
  removeAllConfiguration,

  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  // Test-only

  _getAllMessages,

  // Client-side only

  shutdown,
  removeAllMessagesInConversation,

  removeOtherData,
  cleanupOrphanedAttachments,
  ensureFilePermissions,

  // Client-side only, and test-only

  _removeConversations,
};

export default dataInterface;

function _cleanData(
  data: unknown
): ReturnType<typeof cleanDataForIpc>['cleaned'] {
  const { cleaned, pathsChanged } = cleanDataForIpc(data);

  if (pathsChanged.length) {
    window.log.info(
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

function keysToArrayBuffer(keys: Array<string>, data: any) {
  const updated = cloneDeep(data);

  const max = keys.length;
  for (let i = 0; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, base64ToArrayBuffer(value));
    }
  }

  return updated;
}

function keysFromArrayBuffer(keys: Array<string>, data: any) {
  const updated = cloneDeep(data);

  const max = keys.length;
  for (let i = 0; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, arrayBufferToBase64(value));
    }
  }

  return updated;
}

// Top-level calls

async function shutdown() {
  await waitForPendingQueries();
  // Close database
  await close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function close() {
  await Server.close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeDB() {
  await Server.removeDB();
}

async function removeIndexedDBFiles() {
  await Server.removeIndexedDBFiles();
}

// Identity Keys

const IDENTITY_KEY_KEYS = ['publicKey'];
async function createOrUpdateIdentityKey(data: IdentityKeyType) {
  const updated = keysFromArrayBuffer(IDENTITY_KEY_KEYS, {
    ...data,
    id: window.ConversationController.getConversationId(data.id),
  });
  await Server.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(identifier: string) {
  const id = window.ConversationController.getConversationId(identifier);
  if (!id) {
    throw new Error('getIdentityKeyById: unable to find conversationId');
  }
  const data = await Server.getIdentityKeyById(id);

  return keysToArrayBuffer(IDENTITY_KEY_KEYS, data);
}
async function bulkAddIdentityKeys(array: Array<IdentityKeyType>) {
  const updated = map(array, data =>
    keysFromArrayBuffer(IDENTITY_KEY_KEYS, data)
  );
  await Server.bulkAddIdentityKeys(updated);
}
async function removeIdentityKeyById(identifier: string) {
  const id = window.ConversationController.getConversationId(identifier);
  if (!id) {
    throw new Error('removeIdentityKeyById: unable to find conversationId');
  }
  await Server.removeIdentityKeyById(id);
}
async function removeAllIdentityKeys() {
  await Server.removeAllIdentityKeys();
}
async function getAllIdentityKeys() {
  const keys = await Server.getAllIdentityKeys();

  return keys.map(key => keysToArrayBuffer(IDENTITY_KEY_KEYS, key));
}

// Pre Keys

async function createOrUpdatePreKey(data: PreKeyType) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await Server.createOrUpdatePreKey(updated);
}
async function getPreKeyById(id: number) {
  const data = await Server.getPreKeyById(id);

  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function bulkAddPreKeys(array: Array<PreKeyType>) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await Server.bulkAddPreKeys(updated);
}
async function removePreKeyById(id: number) {
  await Server.removePreKeyById(id);
}
async function removeAllPreKeys() {
  await Server.removeAllPreKeys();
}
async function getAllPreKeys() {
  const keys = await Server.getAllPreKeys();

  return keys.map(key => keysToArrayBuffer(PRE_KEY_KEYS, key));
}

// Signed Pre Keys

const PRE_KEY_KEYS = ['privateKey', 'publicKey'];
async function createOrUpdateSignedPreKey(data: SignedPreKeyType) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await Server.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(id: number) {
  const data = await Server.getSignedPreKeyById(id);

  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getAllSignedPreKeys() {
  const keys = await Server.getAllSignedPreKeys();

  return keys.map((key: SignedPreKeyType) =>
    keysToArrayBuffer(PRE_KEY_KEYS, key)
  );
}
async function bulkAddSignedPreKeys(array: Array<SignedPreKeyType>) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await Server.bulkAddSignedPreKeys(updated);
}
async function removeSignedPreKeyById(id: number) {
  await Server.removeSignedPreKeyById(id);
}
async function removeAllSignedPreKeys() {
  await Server.removeAllSignedPreKeys();
}

// Items

const ITEM_KEYS: { [key: string]: Array<string> | undefined } = {
  identityKey: ['value.pubKey', 'value.privKey'],
  senderCertificate: ['value.serialized'],
  senderCertificateNoE164: ['value.serialized'],
  signaling_key: ['value'],
  profileKey: ['value'],
};
async function createOrUpdateItem(data: ItemType) {
  const { id } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateItem: Provided data did not have a truthy id'
    );
  }

  const keys = ITEM_KEYS[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await Server.createOrUpdateItem(updated);
}
async function getItemById(id: string) {
  const keys = ITEM_KEYS[id];
  const data = await Server.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}
async function getAllItems() {
  const items = await Server.getAllItems();

  return map(items, item => {
    const { id } = item;
    const keys = ITEM_KEYS[id];

    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}
async function bulkAddItems(array: Array<ItemType>) {
  const updated = map(array, data => {
    const { id } = data;
    const keys = ITEM_KEYS[id];

    return keys && Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;
  });
  await Server.bulkAddItems(updated);
}
async function removeItemById(id: string) {
  await Server.removeItemById(id);
}
async function removeAllItems() {
  await Server.removeAllItems();
}

// Sessions

async function createOrUpdateSession(data: SessionType) {
  await Server.createOrUpdateSession(data);
}
async function createOrUpdateSessions(array: Array<SessionType>) {
  await Server.createOrUpdateSessions(array);
}
async function getSessionById(id: string) {
  const session = await Server.getSessionById(id);

  return session;
}
async function getSessionsById(id: string) {
  const sessions = await Server.getSessionsById(id);

  return sessions;
}
async function bulkAddSessions(array: Array<SessionType>) {
  await Server.bulkAddSessions(array);
}
async function removeSessionById(id: string) {
  await Server.removeSessionById(id);
}

async function removeSessionsByConversation(conversationId: string) {
  await Server.removeSessionsByConversation(conversationId);
}
async function removeAllSessions() {
  await Server.removeAllSessions();
}
async function getAllSessions() {
  const sessions = await Server.getAllSessions();

  return sessions;
}

// Conversation

async function getConversationCount() {
  return Server.getConversationCount();
}

async function saveConversation(data: ConversationType) {
  await Server.saveConversation(data);
}

async function saveConversations(array: Array<ConversationType>) {
  await Server.saveConversations(array);
}

async function getConversationById(
  id: string,
  { Conversation }: { Conversation: typeof ConversationModel }
) {
  const data = await Server.getConversationById(id);

  return new Conversation(data);
}

const updateConversationBatcher = createBatcher<ConversationType>({
  wait: 500,
  maxSize: 20,
  processBatch: async (items: Array<ConversationType>) => {
    // We only care about the most recent update for each conversation
    const byId = groupBy(items, item => item.id);
    const ids = Object.keys(byId);
    const mostRecent = ids.map(id => last(byId[id]));

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
  await Server.updateConversations(cleaned);
}

async function removeConversation(
  id: string,
  { Conversation }: { Conversation: typeof ConversationModel }
) {
  const existing = await getConversationById(id, { Conversation });

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await Server.removeConversation(id);
    await existing.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeConversations(ids: Array<string>) {
  await Server.removeConversation(ids);
}

async function eraseStorageServiceStateFromConversations() {
  await Server.eraseStorageServiceStateFromConversations();
}

async function getAllConversations({
  ConversationCollection,
}: {
  ConversationCollection: typeof ConversationModelCollectionType;
}): Promise<ConversationModelCollectionType> {
  const conversations = await Server.getAllConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);

  return collection;
}

async function getAllConversationIds() {
  const ids = await Server.getAllConversationIds();

  return ids;
}

async function getAllPrivateConversations({
  ConversationCollection,
}: {
  ConversationCollection: typeof ConversationModelCollectionType;
}) {
  const conversations = await Server.getAllPrivateConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);

  return collection;
}

async function getAllGroupsInvolvingId(
  id: string,
  {
    ConversationCollection,
  }: {
    ConversationCollection: typeof ConversationModelCollectionType;
  }
) {
  const conversations = await Server.getAllGroupsInvolvingId(id);

  const collection = new ConversationCollection();
  collection.add(conversations);

  return collection;
}

async function searchConversations(query: string) {
  const conversations = await Server.searchConversations(query);

  return conversations;
}

function handleSearchMessageJSON(messages: Array<SearchResultMessageType>) {
  return messages.map(message => ({
    ...JSON.parse(message.json),
    snippet: message.snippet,
  }));
}

async function searchMessages(
  query: string,
  { limit }: { limit?: number } = {}
) {
  const messages = await Server.searchMessages(query, { limit });

  return handleSearchMessageJSON(messages);
}

async function searchMessagesInConversation(
  query: string,
  conversationId: string,
  { limit }: { limit?: number } = {}
) {
  const messages = await Server.searchMessagesInConversation(
    query,
    conversationId,
    { limit }
  );

  return handleSearchMessageJSON(messages);
}

// Message

async function getMessageCount(conversationId?: string) {
  return Server.getMessageCount(conversationId);
}

async function saveMessage(
  data: MessageType,
  { forceSave, Message }: { forceSave?: boolean; Message: typeof MessageModel }
) {
  const id = await Server.saveMessage(_cleanMessageData(data), {
    forceSave,
  });
  Message.updateTimers();

  return id;
}

async function saveMessages(
  arrayOfMessages: Array<MessageType>,
  { forceSave }: { forceSave?: boolean } = {}
) {
  await Server.saveMessages(
    arrayOfMessages.map(message => _cleanMessageData(message)),
    { forceSave }
  );
}

async function removeMessage(
  id: string,
  { Message }: { Message: typeof MessageModel }
) {
  const message = await getMessageById(id, { Message });

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await Server.removeMessage(id);
    await message.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function removeMessages(ids: Array<string>) {
  await Server.removeMessages(ids);
}

async function getMessageById(
  id: string,
  { Message }: { Message: typeof MessageModel }
) {
  const message = await Server.getMessageById(id);
  if (!message) {
    return null;
  }

  return new Message(message);
}

// For testing only
async function _getAllMessages({
  MessageCollection,
}: {
  MessageCollection: typeof MessageModelCollectionType;
}) {
  const messages = await Server._getAllMessages();

  return new MessageCollection(messages);
}

async function getAllMessageIds() {
  const ids = await Server.getAllMessageIds();

  return ids;
}

async function getMessageBySender(
  {
    source,
    sourceUuid,
    sourceDevice,
    sent_at,
  }: {
    source: string;
    sourceUuid: string;
    sourceDevice: string;
    sent_at: number;
  },
  { Message }: { Message: typeof MessageModel }
) {
  const messages = await Server.getMessageBySender({
    source,
    sourceUuid,
    sourceDevice,
    sent_at,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new Message(messages[0]);
}

async function getUnreadByConversation(
  conversationId: string,
  {
    MessageCollection,
  }: { MessageCollection: typeof MessageModelCollectionType }
) {
  const messages = await Server.getUnreadByConversation(conversationId);

  return new MessageCollection(messages);
}

function handleMessageJSON(messages: Array<MessageTypeUnhydrated>) {
  return messages.map(message => JSON.parse(message.json));
}

async function getOlderMessagesByConversation(
  conversationId: string,
  {
    limit = 100,
    receivedAt = Number.MAX_VALUE,
    sentAt = Number.MAX_VALUE,
    messageId,
    MessageCollection,
  }: {
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    messageId?: string;
    MessageCollection: typeof MessageModelCollectionType;
  }
) {
  const messages = await Server.getOlderMessagesByConversation(conversationId, {
    limit,
    receivedAt,
    sentAt,
    messageId,
  });

  return new MessageCollection(handleMessageJSON(messages));
}
async function getNewerMessagesByConversation(
  conversationId: string,
  {
    limit = 100,
    receivedAt = 0,
    sentAt = 0,
    MessageCollection,
  }: {
    limit?: number;
    receivedAt?: number;
    sentAt?: number;
    MessageCollection: typeof MessageModelCollectionType;
  }
) {
  const messages = await Server.getNewerMessagesByConversation(conversationId, {
    limit,
    receivedAt,
    sentAt,
  });

  return new MessageCollection(handleMessageJSON(messages));
}
async function getLastConversationActivity({
  conversationId,
  ourConversationId,
  Message,
}: {
  conversationId: string;
  ourConversationId: string;
  Message: typeof MessageModel;
}): Promise<MessageModel | undefined> {
  const result = await Server.getLastConversationActivity({
    conversationId,
    ourConversationId,
  });
  if (result) {
    return new Message(result);
  }
  return undefined;
}
async function getLastConversationPreview({
  conversationId,
  ourConversationId,
  Message,
}: {
  conversationId: string;
  ourConversationId: string;
  Message: typeof MessageModel;
}): Promise<MessageModel | undefined> {
  const result = await Server.getLastConversationPreview({
    conversationId,
    ourConversationId,
  });
  if (result) {
    return new Message(result);
  }
  return undefined;
}
async function getMessageMetricsForConversation(conversationId: string) {
  const result = await Server.getMessageMetricsForConversation(conversationId);

  return result;
}
function hasGroupCallHistoryMessage(
  conversationId: string,
  eraId: string
): Promise<boolean> {
  return Server.hasGroupCallHistoryMessage(conversationId, eraId);
}
async function migrateConversationMessages(
  obsoleteId: string,
  currentId: string
) {
  await Server.migrateConversationMessages(obsoleteId, currentId);
}

async function removeAllMessagesInConversation(
  conversationId: string,
  {
    logId,
    MessageCollection,
  }: {
    logId: string;
    MessageCollection: typeof MessageModelCollectionType;
  }
) {
  let messages;
  do {
    const chunkSize = 20;
    window.log.info(
      `removeAllMessagesInConversation/${logId}: Fetching chunk of ${chunkSize} messages`
    );
    // Yes, we really want the await in the loop. We're deleting a chunk at a
    //   time so we don't use too much memory.
    messages = await getOlderMessagesByConversation(conversationId, {
      limit: chunkSize,
      MessageCollection,
    });

    if (!messages.length) {
      return;
    }

    const ids = messages.map((message: MessageModel) => message.id);

    window.log.info(`removeAllMessagesInConversation/${logId}: Cleanup...`);
    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    const queue = new window.PQueue({ concurrency: 3, timeout: 1000 * 60 * 2 });
    queue.addAll(
      messages.map((message: MessageModel) => async () => message.cleanup())
    );
    await queue.onIdle();

    window.log.info(`removeAllMessagesInConversation/${logId}: Deleting...`);
    await Server.removeMessages(ids);
  } while (messages.length > 0);
}

async function getMessagesBySentAt(
  sentAt: number,
  {
    MessageCollection,
  }: { MessageCollection: typeof MessageModelCollectionType }
) {
  const messages = await Server.getMessagesBySentAt(sentAt);

  return new MessageCollection(messages);
}

async function getExpiredMessages({
  MessageCollection,
}: {
  MessageCollection: typeof MessageModelCollectionType;
}) {
  const messages = await Server.getExpiredMessages();

  return new MessageCollection(messages);
}

async function getOutgoingWithoutExpiresAt({
  MessageCollection,
}: {
  MessageCollection: typeof MessageModelCollectionType;
}) {
  const messages = await Server.getOutgoingWithoutExpiresAt();

  return new MessageCollection(messages);
}

async function getNextExpiringMessage({
  Message,
}: {
  Message: typeof MessageModel;
}) {
  const message = await Server.getNextExpiringMessage();

  if (message) {
    return new Message(message);
  }

  return null;
}

async function getNextTapToViewMessageToAgeOut({
  Message,
}: {
  Message: typeof MessageModel;
}) {
  const message = await Server.getNextTapToViewMessageToAgeOut();
  if (!message) {
    return null;
  }

  return new Message(message);
}
async function getTapToViewMessagesNeedingErase({
  MessageCollection,
}: {
  MessageCollection: typeof MessageModelCollectionType;
}) {
  const messages = await Server.getTapToViewMessagesNeedingErase();

  return new MessageCollection(messages);
}

// Unprocessed

async function getUnprocessedCount() {
  return Server.getUnprocessedCount();
}

async function getAllUnprocessed() {
  return Server.getAllUnprocessed();
}

async function getUnprocessedById(id: string) {
  return Server.getUnprocessedById(id);
}

async function saveUnprocessed(
  data: UnprocessedType,
  { forceSave }: { forceSave?: boolean } = {}
) {
  const id = await Server.saveUnprocessed(_cleanData(data), { forceSave });

  return id;
}

async function saveUnprocesseds(
  arrayOfUnprocessed: Array<UnprocessedType>,
  { forceSave }: { forceSave?: boolean } = {}
) {
  await Server.saveUnprocesseds(_cleanData(arrayOfUnprocessed), {
    forceSave,
  });
}

async function updateUnprocessedAttempts(id: string, attempts: number) {
  await Server.updateUnprocessedAttempts(id, attempts);
}
async function updateUnprocessedWithData(id: string, data: UnprocessedType) {
  await Server.updateUnprocessedWithData(id, data);
}
async function updateUnprocessedsWithData(array: Array<UnprocessedType>) {
  await Server.updateUnprocessedsWithData(array);
}

async function removeUnprocessed(id: string | Array<string>) {
  await Server.removeUnprocessed(id);
}

async function removeAllUnprocessed() {
  await Server.removeAllUnprocessed();
}

// Attachment downloads

async function getNextAttachmentDownloadJobs(
  limit?: number,
  options?: { timestamp?: number }
) {
  return Server.getNextAttachmentDownloadJobs(limit, options);
}
async function saveAttachmentDownloadJob(job: AttachmentDownloadJobType) {
  await Server.saveAttachmentDownloadJob(_cleanData(job));
}
async function setAttachmentDownloadJobPending(id: string, pending: boolean) {
  await Server.setAttachmentDownloadJobPending(id, pending);
}
async function resetAttachmentDownloadPending() {
  await Server.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id: string) {
  await Server.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs() {
  await Server.removeAllAttachmentDownloadJobs();
}

// Stickers

async function getStickerCount() {
  return Server.getStickerCount();
}

async function createOrUpdateStickerPack(pack: StickerPackType) {
  await Server.createOrUpdateStickerPack(pack);
}
async function updateStickerPackStatus(
  packId: string,
  status: StickerPackStatusType,
  options?: { timestamp: number }
) {
  await Server.updateStickerPackStatus(packId, status, options);
}
async function createOrUpdateSticker(sticker: StickerType) {
  await Server.createOrUpdateSticker(sticker);
}
async function updateStickerLastUsed(
  packId: string,
  stickerId: number,
  timestamp: number
) {
  await Server.updateStickerLastUsed(packId, stickerId, timestamp);
}
async function addStickerPackReference(messageId: string, packId: string) {
  await Server.addStickerPackReference(messageId, packId);
}
async function deleteStickerPackReference(messageId: string, packId: string) {
  const paths = await Server.deleteStickerPackReference(messageId, packId);

  return paths;
}
async function deleteStickerPack(packId: string) {
  const paths = await Server.deleteStickerPack(packId);

  return paths;
}
async function getAllStickerPacks() {
  const packs = await Server.getAllStickerPacks();

  return packs;
}
async function getAllStickers() {
  const stickers = await Server.getAllStickers();

  return stickers;
}
async function getRecentStickers() {
  const recentStickers = await Server.getRecentStickers();

  return recentStickers;
}
async function clearAllErrorStickerPackAttempts() {
  await Server.clearAllErrorStickerPackAttempts();
}

// Emojis
async function updateEmojiUsage(shortName: string) {
  await Server.updateEmojiUsage(shortName);
}
async function getRecentEmojis(limit = 32) {
  return Server.getRecentEmojis(limit);
}

// Other

async function removeAll() {
  await Server.removeAll();
}

async function removeAllConfiguration() {
  await Server.removeAllConfiguration();
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
  return new Promise<void>((resolve, reject) => {
    ipcRenderer.send(name);
    ipcRenderer.once(`${name}-done`, (_, error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });

    setTimeout(() => {
      reject(new Error(`callChannel call to ${name} timed out`));
    }, DATABASE_UPDATE_TIMEOUT);
  });
}

async function getMessagesNeedingUpgrade(
  limit: number,
  { maxVersion = CURRENT_SCHEMA_VERSION }: { maxVersion: number }
) {
  const messages = await Server.getMessagesNeedingUpgrade(limit, {
    maxVersion,
  });

  return messages;
}

async function getMessagesWithVisualMediaAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
  return Server.getMessagesWithVisualMediaAttachments(conversationId, {
    limit,
  });
}

async function getMessagesWithFileAttachments(
  conversationId: string,
  { limit }: { limit: number }
) {
  return Server.getMessagesWithFileAttachments(conversationId, {
    limit,
  });
}
