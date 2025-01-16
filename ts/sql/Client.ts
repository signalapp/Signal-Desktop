// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import { groupBy, isTypedArray, last, map, omit } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';

// Note: nothing imported here can come back and require Client.ts, and that includes
// their imports too. That circularity causes problems. Anything that would do that needs
// to be passed in, like cleanupMessages below.
import * as Bytes from '../Bytes';
import * as log from '../logging/log';
import * as Errors from '../types/errors';

import { deleteExternalFiles } from '../types/Conversation';
import { createBatcher } from '../util/batcher';
import { assertDev, softAssert } from '../util/assert';
import { mapObjectWithSpec } from '../util/mapObjectWithSpec';
import { cleanDataForIpc } from './cleanDataForIpc';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import { isValidUuid, isValidUuidV7 } from '../util/isValidUuid';
import { formatJobForInsert } from '../jobs/formatJobForInsert';
import { AccessType, ipcInvoke, doShutdown, removeDB } from './channels';
import { getMessageIdForLogging } from '../util/idForLogging';
import { incrementMessageCounter } from '../util/incrementMessageCounter';
import { generateSnippetAroundMention } from '../util/search';
import { drop } from '../util/drop';

import type { ObjectMappingSpecType } from '../util/mapObjectWithSpec';
import type { AciString, ServiceIdString } from '../types/ServiceId';
import type { StoredJob } from '../jobs/types';
import type {
  ClientInterfaceWrap,
  AdjacentMessagesByConversationOptionsType,
  AllItemsType,
  ServerReadableDirectInterface,
  ServerWritableDirectInterface,
  ClientReadableInterface,
  ClientWritableInterface,
  ClientSearchResultMessageType,
  ConversationType,
  GetConversationRangeCenteredOnMessageResultType,
  GetRecentStoryRepliesOptionsType,
  IdentityKeyIdType,
  IdentityKeyType,
  StoredIdentityKeyType,
  ItemKeyType,
  ItemType,
  StoredItemType,
  MessageType,
  MessageTypeUnhydrated,
  PreKeyIdType,
  PreKeyType,
  StoredPreKeyType,
  ServerSearchResultMessageType,
  SignedPreKeyIdType,
  SignedPreKeyType,
  StoredSignedPreKeyType,
  KyberPreKeyType,
  StoredKyberPreKeyType,
  ClientOnlyReadableInterface,
  ClientOnlyWritableInterface,
} from './Interface';
import { hydrateMessage } from './hydration';
import type { MessageAttributesType } from '../model-types';
import type { AttachmentDownloadJobType } from '../types/AttachmentDownload';

const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const ERASE_STICKERS_KEY = 'erase-stickers';
const ERASE_TEMP_KEY = 'erase-temp';
const ERASE_DRAFTS_KEY = 'erase-drafts';
const ERASE_DOWNLOADS_KEY = 'erase-downloads';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';
const ENSURE_FILE_PERMISSIONS = 'ensure-file-permissions';
const PAUSE_WRITE_ACCESS = 'pause-sql-writes';
const RESUME_WRITE_ACCESS = 'resume-sql-writes';

const clientOnlyReadable: ClientOnlyReadableInterface = {
  getIdentityKeyById,
  getAllIdentityKeys,

  getKyberPreKeyById,
  getAllKyberPreKeys,

  getPreKeyById,
  getAllPreKeys,

  getSignedPreKeyById,
  getAllSignedPreKeys,

  getItemById,
  getAllItems,

  searchMessages,

  getRecentStoryReplies,
  getOlderMessagesByConversation,
  getNewerMessagesByConversation,
  getConversationRangeCenteredOnMessage,
};

const clientOnlyWritable: ClientOnlyWritableInterface = {
  createOrUpdateIdentityKey,
  bulkAddIdentityKeys,

  createOrUpdateKyberPreKey,
  bulkAddKyberPreKeys,

  createOrUpdatePreKey,
  bulkAddPreKeys,

  createOrUpdateSignedPreKey,
  bulkAddSignedPreKeys,

  createOrUpdateItem,

  updateConversation,
  removeConversation,

  removeMessage,
  removeMessages,

  saveMessage,
  saveMessages,
  saveMessagesIndividually,

  // Client-side only

  flushUpdateConversationBatcher,

  removeDB,
  shutdown,
  removeMessagesInConversation,

  removeOtherData,
  cleanupOrphanedAttachments,
  ensureFilePermissions,
};

type ClientOverridesType = ClientOnlyWritableInterface &
  Pick<
    ClientInterfaceWrap<ServerWritableDirectInterface>,
    'saveAttachmentDownloadJob' | 'updateConversations'
  >;

const clientOnlyWritableOverrides: ClientOverridesType = {
  ...clientOnlyWritable,
  saveAttachmentDownloadJob,
  updateConversations,
};

type ReadableChannelInterface =
  ClientInterfaceWrap<ServerReadableDirectInterface>;

const readableChannel: ReadableChannelInterface = new Proxy(
  {} as ReadableChannelInterface,
  {
    get(_target, name) {
      return async (...args: ReadonlyArray<unknown>) =>
        ipcInvoke(AccessType.Read, String(name), args);
    },
  }
);

type WritableChannelInterface =
  ClientInterfaceWrap<ServerWritableDirectInterface>;

const writableChannel: WritableChannelInterface = new Proxy(
  {} as WritableChannelInterface,
  {
    get(_target, name) {
      return async (...args: ReadonlyArray<unknown>) =>
        ipcInvoke(AccessType.Write, String(name), args);
    },
  }
);

export const DataReader: ClientReadableInterface = new Proxy(
  {
    ...clientOnlyReadable,
  } as ClientReadableInterface,
  {
    get(target, name) {
      return async (...args: ReadonlyArray<unknown>) => {
        if (Reflect.has(target, name)) {
          return Reflect.get(target, name)(...args);
        }

        return Reflect.get(readableChannel, name)(...args);
      };
    },
  }
);

export const DataWriter: ClientWritableInterface = new Proxy(
  {
    ...clientOnlyWritableOverrides,
  } as ClientWritableInterface,
  {
    get(target, name) {
      return async (...args: ReadonlyArray<unknown>) => {
        if (Reflect.has(target, name)) {
          return Reflect.get(target, name)(...args);
        }

        return Reflect.get(writableChannel, name)(...args);
      };
    },
  }
);

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

export function _cleanMessageData(
  data: ReadonlyDeep<MessageType>
): ReadonlyDeep<MessageType> {
  const result = { ...data };
  // Ensure that all messages have the received_at set properly
  if (!data.received_at) {
    assertDev(false, 'received_at was not set on the message');
    result.received_at = incrementMessageCounter();
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

      if (attachment.screenshotData) {
        assertDev(
          false,
          `_cleanMessageData/${logId}: Attachment ${index} had screenshotData field; deleting`
        );
        return omit(attachment, ['screenshotData']);
      }

      if (attachment.screenshot?.data) {
        assertDev(
          false,
          `_cleanMessageData/${logId}: Attachment ${index} had screenshot.data field; deleting`
        );
        return omit(attachment, ['screenshot.data']);
      }

      if (attachment.thumbnail?.data) {
        assertDev(
          false,
          `_cleanMessageData/${logId}: Attachment ${index} had thumbnail.data field; deleting`
        );
        return omit(attachment, ['thumbnail.data']);
      }

      return attachment;
    });
  }
  return _cleanData(omit(result, ['dataMessage']));
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
  await doShutdown();
}

// Identity Keys

const IDENTITY_KEY_SPEC = ['publicKey'];
async function createOrUpdateIdentityKey(data: IdentityKeyType): Promise<void> {
  const updated: StoredIdentityKeyType = specFromBytes(IDENTITY_KEY_SPEC, data);
  await writableChannel.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(
  id: IdentityKeyIdType
): Promise<IdentityKeyType | undefined> {
  const data = await readableChannel.getIdentityKeyById(id);

  return specToBytes(IDENTITY_KEY_SPEC, data);
}
async function bulkAddIdentityKeys(
  array: Array<IdentityKeyType>
): Promise<void> {
  const updated: Array<StoredIdentityKeyType> = map(array, data =>
    specFromBytes(IDENTITY_KEY_SPEC, data)
  );
  await writableChannel.bulkAddIdentityKeys(updated);
}
async function getAllIdentityKeys(): Promise<Array<IdentityKeyType>> {
  const keys = await readableChannel.getAllIdentityKeys();

  return keys.map(key => specToBytes(IDENTITY_KEY_SPEC, key));
}

// Kyber Pre Keys

const KYBER_PRE_KEY_SPEC = ['data'];
async function createOrUpdateKyberPreKey(data: KyberPreKeyType): Promise<void> {
  const updated: StoredKyberPreKeyType = specFromBytes(
    KYBER_PRE_KEY_SPEC,
    data
  );
  await writableChannel.createOrUpdateKyberPreKey(updated);
}
async function getKyberPreKeyById(
  id: PreKeyIdType
): Promise<KyberPreKeyType | undefined> {
  const data = await readableChannel.getPreKeyById(id);

  return specToBytes(KYBER_PRE_KEY_SPEC, data);
}
async function bulkAddKyberPreKeys(
  array: Array<KyberPreKeyType>
): Promise<void> {
  const updated: Array<StoredKyberPreKeyType> = map(array, data =>
    specFromBytes(KYBER_PRE_KEY_SPEC, data)
  );
  await writableChannel.bulkAddKyberPreKeys(updated);
}
async function getAllKyberPreKeys(): Promise<Array<KyberPreKeyType>> {
  const keys = await readableChannel.getAllKyberPreKeys();

  return keys.map(key => specToBytes(KYBER_PRE_KEY_SPEC, key));
}

// Pre Keys

async function createOrUpdatePreKey(data: PreKeyType): Promise<void> {
  const updated: StoredPreKeyType = specFromBytes(PRE_KEY_SPEC, data);
  await writableChannel.createOrUpdatePreKey(updated);
}
async function getPreKeyById(
  id: PreKeyIdType
): Promise<PreKeyType | undefined> {
  const data = await readableChannel.getPreKeyById(id);

  return specToBytes(PRE_KEY_SPEC, data);
}
async function bulkAddPreKeys(array: Array<PreKeyType>): Promise<void> {
  const updated: Array<StoredPreKeyType> = map(array, data =>
    specFromBytes(PRE_KEY_SPEC, data)
  );
  await writableChannel.bulkAddPreKeys(updated);
}
async function getAllPreKeys(): Promise<Array<PreKeyType>> {
  const keys = await readableChannel.getAllPreKeys();

  return keys.map(key => specToBytes(PRE_KEY_SPEC, key));
}

// Signed Pre Keys

const PRE_KEY_SPEC = ['privateKey', 'publicKey'];
async function createOrUpdateSignedPreKey(
  data: SignedPreKeyType
): Promise<void> {
  const updated: StoredSignedPreKeyType = specFromBytes(PRE_KEY_SPEC, data);
  await writableChannel.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(
  id: SignedPreKeyIdType
): Promise<SignedPreKeyType | undefined> {
  const data = await readableChannel.getSignedPreKeyById(id);

  return specToBytes(PRE_KEY_SPEC, data);
}
async function getAllSignedPreKeys(): Promise<Array<SignedPreKeyType>> {
  const keys = await readableChannel.getAllSignedPreKeys();

  return keys.map(key => specToBytes(PRE_KEY_SPEC, key));
}
async function bulkAddSignedPreKeys(
  array: Array<SignedPreKeyType>
): Promise<void> {
  const updated: Array<StoredSignedPreKeyType> = map(array, data =>
    specFromBytes(PRE_KEY_SPEC, data)
  );
  await writableChannel.bulkAddSignedPreKeys(updated);
}

// Items

const ITEM_SPECS: Partial<Record<ItemKeyType, ObjectMappingSpecType>> = {
  defaultWallpaperPhotoPointer: ['value'],
  identityKeyMap: {
    key: 'value',
    valueSpec: {
      isMap: true,
      valueSpec: ['privKey', 'pubKey'],
    },
  },
  profileKey: ['value'],
  senderCertificate: ['value.serialized'],
  senderCertificateNoE164: ['value.serialized'],
  subscriberId: ['value'],
  backupsSubscriberId: ['value'],
  backupEphemeralKey: ['value'],
  backupMediaRootKey: ['value'],
  manifestRecordIkm: ['value'],
  usernameLink: ['value.entropy', 'value.serverId'],
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

  await writableChannel.createOrUpdateItem(updated);
}
async function getItemById<K extends ItemKeyType>(
  id: K
): Promise<ItemType<K> | undefined> {
  const spec = ITEM_SPECS[id];
  const data = await readableChannel.getItemById(id);

  try {
    return spec ? specToBytes(spec, data) : (data as unknown as ItemType<K>);
  } catch (error) {
    log.warn(`getItemById(${id}): Failed to parse item from spec`, error);
    return undefined;
  }
}
async function getAllItems(): Promise<AllItemsType> {
  const items = await readableChannel.getAllItems();

  const result = Object.create(null);

  for (const id of Object.keys(items)) {
    const key = id as ItemKeyType;
    const value = items[key];

    const keys = ITEM_SPECS[key];

    try {
      const deserializedValue = keys
        ? (specToBytes(keys, { value }) as ItemType<typeof key>).value
        : value;

      result[key] = deserializedValue;
    } catch (error) {
      log.warn(`getAllItems(${id}): Failed to parse item from spec`, error);
    }
  }

  return result;
}

// Conversation

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
      assertDev(maybeLast !== undefined, 'Empty array in `groupBy` result');
      return maybeLast;
    });

    await updateConversations(mostRecent);
  },
});

async function updateConversation(data: ConversationType): Promise<void> {
  updateConversationBatcher.add(data);
}
async function flushUpdateConversationBatcher(): Promise<void> {
  await updateConversationBatcher.flushAndWait();
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const { cleaned, pathsChanged } = cleanDataForIpc(array);
  assertDev(
    !pathsChanged.length,
    `Paths were cleaned: ${JSON.stringify(pathsChanged)}`
  );
  await writableChannel.updateConversations(cleaned);
}

async function removeConversation(id: string): Promise<void> {
  const existing = await readableChannel.getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await writableChannel.removeConversation(id);
    await deleteExternalFiles(existing, {
      deleteAttachmentData: window.Signal.Migrations.deleteAttachmentData,
    });
  }
}

function handleSearchMessageJSON(
  messages: Array<ServerSearchResultMessageType>
): Array<ClientSearchResultMessageType> {
  return messages.map<ClientSearchResultMessageType>(message => {
    const parsedMessage = hydrateMessage(message);
    assertDev(
      message.ftsSnippet ?? typeof message.mentionStart === 'number',
      'Neither ftsSnippet nor matching mention returned from message search'
    );
    const snippet =
      message.ftsSnippet ??
      generateSnippetAroundMention({
        body: parsedMessage.body || '',
        mentionStart: message.mentionStart ?? 0,
        mentionLength: message.mentionLength ?? 1,
      });

    return {
      // Empty array is a default value. `message.json` has the real field
      bodyRanges: [],
      ...parsedMessage,
      snippet,
    };
  });
}

async function searchMessages({
  query,
  options,
  contactServiceIdsMatchingQuery,
  conversationId,
}: {
  query: string;
  options?: { limit?: number };
  contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
  conversationId?: string;
}): Promise<Array<ClientSearchResultMessageType>> {
  const messages = await readableChannel.searchMessages({
    query,
    conversationId,
    options,
    contactServiceIdsMatchingQuery,
  });

  return handleSearchMessageJSON(messages);
}

// Message

async function saveMessage(
  data: ReadonlyDeep<MessageType>,
  {
    forceSave,
    jobToInsert,
    ourAci,
    postSaveUpdates,
  }: {
    forceSave?: boolean;
    jobToInsert?: Readonly<StoredJob>;
    ourAci: AciString;
    postSaveUpdates: () => Promise<void>;
  }
): Promise<string> {
  const id = await writableChannel.saveMessage(_cleanMessageData(data), {
    forceSave,
    jobToInsert: jobToInsert && formatJobForInsert(jobToInsert),
    ourAci,
  });

  softAssert(
    // Older messages still have `UUIDv4` so don't log errors when encountering
    // it.
    (!forceSave && isValidUuid(id)) || isValidUuidV7(id),
    'saveMessage: messageId is not a UUID'
  );

  drop(postSaveUpdates?.());

  return id;
}

async function saveMessages(
  arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
  {
    forceSave,
    ourAci,
    postSaveUpdates,
  }: {
    forceSave?: boolean;
    ourAci: AciString;
    postSaveUpdates: () => Promise<void>;
  }
): Promise<Array<string>> {
  const result = await writableChannel.saveMessages(
    arrayOfMessages.map(message => _cleanMessageData(message)),
    { forceSave, ourAci }
  );

  drop(postSaveUpdates?.());

  return result;
}

async function saveMessagesIndividually(
  arrayOfMessages: ReadonlyArray<ReadonlyDeep<MessageType>>,
  {
    forceSave,
    ourAci,
    postSaveUpdates,
  }: {
    forceSave?: boolean;
    ourAci: AciString;
    postSaveUpdates: () => Promise<void>;
  }
): Promise<{ failedIndices: Array<number> }> {
  const result = await writableChannel.saveMessagesIndividually(
    arrayOfMessages,
    { forceSave, ourAci }
  );

  drop(postSaveUpdates?.());

  return result;
}

async function removeMessage(
  id: string,
  options: {
    cleanupMessages: (
      messages: ReadonlyArray<MessageAttributesType>,
      options: { fromSync?: boolean }
    ) => Promise<void>;
    fromSync?: boolean;
  }
): Promise<void> {
  const message = await readableChannel.getMessageById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await writableChannel.removeMessage(id);
    await options.cleanupMessages([message], {
      fromSync: options.fromSync,
    });
  }
}

export async function deleteAndCleanup(
  messages: Array<MessageAttributesType>,
  logId: string,
  options: {
    fromSync?: boolean;
    cleanupMessages: (
      messages: ReadonlyArray<MessageAttributesType>,
      options: { fromSync?: boolean }
    ) => Promise<void>;
  }
): Promise<void> {
  const ids = messages.map(message => message.id);

  log.info(`deleteAndCleanup/${logId}: Deleting ${ids.length} messages...`);
  await writableChannel.removeMessages(ids);

  log.info(`deleteAndCleanup/${logId}: Cleanup for ${ids.length} messages...`);
  await options.cleanupMessages(messages, {
    fromSync: Boolean(options.fromSync),
  });

  log.info(`deleteAndCleanup/${logId}: Complete`);
}

async function removeMessages(
  messageIds: ReadonlyArray<string>,
  options: {
    fromSync?: boolean;
    cleanupMessages: (
      messages: ReadonlyArray<MessageAttributesType>,
      options: { fromSync?: boolean }
    ) => Promise<void>;
  }
): Promise<void> {
  const messages = await readableChannel.getMessagesById(messageIds);
  await options.cleanupMessages(messages, {
    fromSync: Boolean(options.fromSync),
  });
  await writableChannel.removeMessages(messageIds);
}

function handleMessageJSON(
  messages: Array<MessageTypeUnhydrated>
): Array<MessageType> {
  return messages.map(message => hydrateMessage(message));
}

async function getNewerMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageType>> {
  const messages =
    await readableChannel.getNewerMessagesByConversation(options);

  return handleMessageJSON(messages);
}

async function getRecentStoryReplies(
  storyId: string,
  options?: GetRecentStoryRepliesOptionsType
): Promise<Array<MessageType>> {
  const messages = await readableChannel.getRecentStoryReplies(
    storyId,
    options
  );

  return handleMessageJSON(messages);
}

async function getOlderMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageType>> {
  const messages =
    await readableChannel.getOlderMessagesByConversation(options);

  return handleMessageJSON(messages);
}

async function getConversationRangeCenteredOnMessage(
  options: AdjacentMessagesByConversationOptionsType
): Promise<GetConversationRangeCenteredOnMessageResultType<MessageType>> {
  const result =
    await readableChannel.getConversationRangeCenteredOnMessage(options);

  return {
    ...result,
    older: handleMessageJSON(result.older),
    newer: handleMessageJSON(result.newer),
  };
}

async function removeMessagesInConversation(
  conversationId: string,
  {
    cleanupMessages,
    fromSync,
    logId,
    receivedAt,
  }: {
    cleanupMessages: (
      messages: ReadonlyArray<MessageAttributesType>,
      options: { fromSync?: boolean | undefined }
    ) => Promise<void>;
    fromSync?: boolean;
    logId: string;
    receivedAt?: number;
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
    // eslint-disable-next-line no-await-in-loop
    messages = await getOlderMessagesByConversation({
      conversationId,
      limit: chunkSize,
      includeStoryReplies: true,
      receivedAt,
      storyId: undefined,
    });

    if (!messages.length) {
      return;
    }

    // eslint-disable-next-line no-await-in-loop
    await deleteAndCleanup(messages, logId, { fromSync, cleanupMessages });
  } while (messages.length > 0);
}

// Attachment downloads

async function saveAttachmentDownloadJob(
  job: AttachmentDownloadJobType
): Promise<void> {
  await writableChannel.saveAttachmentDownloadJob(_cleanData(job));
}

// Other

async function cleanupOrphanedAttachments(): Promise<void> {
  try {
    await invokeWithTimeout(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
  } catch (error) {
    log.warn(
      'sql/Client: cleanupOrphanedAttachments failure',
      Errors.toLogFormat(error)
    );
  }
}

async function ensureFilePermissions(): Promise<void> {
  await invokeWithTimeout(ENSURE_FILE_PERMISSIONS);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData(): Promise<void> {
  await Promise.all([
    invokeWithTimeout(ERASE_SQL_KEY),
    invokeWithTimeout(ERASE_ATTACHMENTS_KEY),
    invokeWithTimeout(ERASE_STICKERS_KEY),
    invokeWithTimeout(ERASE_TEMP_KEY),
    invokeWithTimeout(ERASE_DOWNLOADS_KEY),
    invokeWithTimeout(ERASE_DRAFTS_KEY),
  ]);
}

async function invokeWithTimeout(name: string): Promise<void> {
  return createTaskWithTimeout(
    () => ipc.invoke(name),
    `callChannel call to ${name}`
  )();
}

export function pauseWriteAccess(): Promise<void> {
  return invokeWithTimeout(PAUSE_WRITE_ACCESS);
}

export function resumeWriteAccess(): Promise<void> {
  return invokeWithTimeout(RESUME_WRITE_ACCESS);
}
