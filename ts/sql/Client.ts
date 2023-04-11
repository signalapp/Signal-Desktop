// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';
import fs from 'fs-extra';
import pify from 'pify';
import PQueue from 'p-queue';

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
} from 'lodash';

import { deleteExternalFiles } from '../types/Conversation';
import { expiringMessagesDeletionService } from '../services/expiringMessagesDeletion';
import { tapToViewMessagesDeletionService } from '../services/tapToViewMessagesDeletionService';
import * as Bytes from '../Bytes';
import { createBatcher } from '../util/batcher';
import { explodePromise } from '../util/explodePromise';
import { assertDev, softAssert, strictAssert } from '../util/assert';
import { mapObjectWithSpec } from '../util/mapObjectWithSpec';
import type { ObjectMappingSpecType } from '../util/mapObjectWithSpec';
import { cleanDataForIpc } from './cleanDataForIpc';
import type { UUIDStringType } from '../types/UUID';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import * as log from '../logging/log';
import { isValidUuid } from '../types/UUID';
import * as Errors from '../types/errors';

import type { StoredJob } from '../jobs/types';
import { formatJobForInsert } from '../jobs/formatJobForInsert';
import { cleanupMessage } from '../util/cleanup';
import { drop } from '../util/drop';

import type {
  AdjacentMessagesByConversationOptionsType,
  AllItemsType,
  AttachmentDownloadJobType,
  ClientInterface,
  ClientExclusiveInterface,
  ClientSearchResultMessageType,
  ConversationType,
  GetConversationRangeCenteredOnMessageResultType,
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
  ServerInterface,
  ServerSearchResultMessageType,
  SignedPreKeyIdType,
  SignedPreKeyType,
  StoredSignedPreKeyType,
} from './Interface';
import Server from './Server';
import { parseSqliteError, SqliteErrorKind } from './errors';
import { MINUTE } from '../util/durations';
import { getMessageIdForLogging } from '../util/idForLogging';
import type { MessageAttributesType } from '../model-types';
import { incrementMessageCounter } from '../util/incrementMessageCounter';

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

enum RendererState {
  InMain = 'InMain',
  Opening = 'Opening',
  InRenderer = 'InRenderer',
  Closing = 'Closing',
}

let activeJobCount = 0;
let resolveShutdown: (() => void) | undefined;
let shutdownPromise: Promise<void> | null = null;

let state = RendererState.InMain;
const startupQueries = new Map<string, number>();

async function startInRendererProcess(isTesting = false): Promise<void> {
  strictAssert(
    state === RendererState.InMain,
    `startInRendererProcess: expected ${state} to be ${RendererState.InMain}`
  );

  log.info('data.startInRendererProcess: switching to renderer process');
  state = RendererState.Opening;

  if (!isTesting) {
    await ipc.invoke('database-ready');
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
  const closePromise = channels.close();

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
    map(toPairs(Server), ([name, value]: [string, unknown]) => {
      if (isFunction(value)) {
        return [name, makeChannel(name)];
      }

      return null;
    })
  )
) as unknown;

const channels: ServerInterface = channelsAsUnknown as ServerInterface;

const exclusiveInterface: ClientExclusiveInterface = {
  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  bulkAddSignedPreKeys,
  getAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  getAllItems,

  updateConversation,
  removeConversation,

  searchMessages,
  searchMessagesInConversation,

  getOlderMessagesByConversation,
  getConversationRangeCenteredOnMessage,
  getNewerMessagesByConversation,

  // Client-side only

  shutdown,
  removeAllMessagesInConversation,

  removeOtherData,
  cleanupOrphanedAttachments,
  ensureFilePermissions,

  // Client-side only, and test-only

  startInRendererProcess,
  goBackToMainProcess,
};

// Because we can't force this module to conform to an interface, we narrow our exports
//   to this one default export, which does conform to the interface.
// Note: In Javascript, you need to access the .default property when requiring it
// https://github.com/microsoft/TypeScript/issues/420
const dataInterface: ClientInterface = {
  ...channels,
  ...exclusiveInterface,

  // Overrides
  updateConversations,
  saveMessage,
  saveMessages,
  removeMessage,
  removeMessages,
  saveAttachmentDownloadJob,
};

export default dataInterface;

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

      return attachment;
    });
  }
  return _cleanData(omit(result, ['dataMessage']));
}

async function doShutdown() {
  log.info(
    `data.shutdown: shutdown requested. ${activeJobCount} jobs outstanding`
  );

  if (shutdownPromise) {
    return shutdownPromise;
  }

  // No outstanding jobs, return immediately
  if (activeJobCount === 0) {
    return;
  }

  ({ promise: shutdownPromise, resolve: resolveShutdown } =
    explodePromise<void>());

  try {
    await shutdownPromise;
  } finally {
    log.info('data.shutdown: process complete');
  }
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
        const sqliteErrorKind = parseSqliteError(error);
        if (sqliteErrorKind === SqliteErrorKind.Corrupted) {
          log.error(
            'Detected sql corruption in renderer process. ' +
              `Restarting the application immediately. Error: ${error.message}`
          );
          ipc?.send('database-error', error.stack);
        } else if (sqliteErrorKind === SqliteErrorKind.Readonly) {
          log.error(`Detected readonly sql database: ${error.message}`);
          ipc?.send('database-readonly');
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

        if (duration > MIN_TRACE_DURATION) {
          log.info(
            `Renderer SQL channel job (${fnName}) completed in ${duration}ms`
          );
        }
      }
    }

    if (shutdownPromise && fnName !== 'close') {
      throw new Error(
        `Rejecting SQL channel job (${fnName}); application is shutting down`
      );
    }

    activeJobCount += 1;
    return createTaskWithTimeout(async () => {
      try {
        return await ipc.invoke(SQL_CHANNEL_KEY, fnName, ...args);
      } finally {
        activeJobCount -= 1;
        if (activeJobCount === 0) {
          resolveShutdown?.();
        }
      }
    }, `SQL channel call (${fnName})`)();
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
  await doShutdown();

  // Close database
  await channels.close();
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

// Items

const ITEM_SPECS: Partial<Record<ItemKeyType, ObjectMappingSpecType>> = {
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

function updateConversation(data: ConversationType): void {
  updateConversationBatcher.add(data);
}

async function updateConversations(
  array: Array<ConversationType>
): Promise<void> {
  const { cleaned, pathsChanged } = cleanDataForIpc(array);
  assertDev(
    !pathsChanged.length,
    `Paths were cleaned: ${JSON.stringify(pathsChanged)}`
  );
  await channels.updateConversations(cleaned);
}

async function removeConversation(id: string): Promise<void> {
  const existing = await channels.getConversationById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await deleteExternalFiles(existing, {
      deleteAttachmentData: window.Signal.Migrations.deleteAttachmentData,
    });
  }
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

  softAssert(isValidUuid(id), 'saveMessage: messageId is not a UUID');

  void expiringMessagesDeletionService.update();
  void tapToViewMessagesDeletionService.update();

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

  void expiringMessagesDeletionService.update();
  void tapToViewMessagesDeletionService.update();
}

async function removeMessage(id: string): Promise<void> {
  const message = await channels.getMessageById(id);

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await cleanupMessage(message);
  }
}

async function _cleanupMessages(
  messages: ReadonlyArray<MessageAttributesType>
): Promise<void> {
  const queue = new PQueue({ concurrency: 3, timeout: MINUTE * 30 });
  drop(
    queue.addAll(
      messages.map(
        (message: MessageAttributesType) => async () => cleanupMessage(message)
      )
    )
  );
  await queue.onIdle();
}

async function removeMessages(
  messageIds: ReadonlyArray<string>
): Promise<void> {
  const messages = await channels.getMessagesById(messageIds);
  await _cleanupMessages(messages);
  await channels.removeMessages(messageIds);
}

function handleMessageJSON(
  messages: Array<MessageTypeUnhydrated>
): Array<MessageType> {
  return messages.map(message => JSON.parse(message.json));
}

async function getNewerMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageType>> {
  const messages = await channels.getNewerMessagesByConversation(options);

  return handleMessageJSON(messages);
}

async function getOlderMessagesByConversation(
  options: AdjacentMessagesByConversationOptionsType
): Promise<Array<MessageType>> {
  const messages = await channels.getOlderMessagesByConversation(options);

  return handleMessageJSON(messages);
}

async function getConversationRangeCenteredOnMessage(
  options: AdjacentMessagesByConversationOptionsType
): Promise<GetConversationRangeCenteredOnMessageResultType<MessageType>> {
  const result = await channels.getConversationRangeCenteredOnMessage(options);

  return {
    ...result,
    older: handleMessageJSON(result.older),
    newer: handleMessageJSON(result.newer),
  };
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
    // eslint-disable-next-line no-await-in-loop
    messages = await getOlderMessagesByConversation({
      conversationId,
      limit: chunkSize,
      includeStoryReplies: true,
      storyId: undefined,
    });

    if (!messages.length) {
      return;
    }

    const ids = messages.map(message => message.id);

    log.info(`removeAllMessagesInConversation/${logId}: Cleanup...`);
    // eslint-disable-next-line no-await-in-loop
    await _cleanupMessages(messages);

    log.info(`removeAllMessagesInConversation/${logId}: Deleting...`);
    // eslint-disable-next-line no-await-in-loop
    await channels.removeMessages(ids);
  } while (messages.length > 0);
}

// Attachment downloads

async function saveAttachmentDownloadJob(
  job: AttachmentDownloadJobType
): Promise<void> {
  await channels.saveAttachmentDownloadJob(_cleanData(job));
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
    invokeWithTimeout(ERASE_DRAFTS_KEY),
  ]);
}

async function invokeWithTimeout(name: string): Promise<void> {
  return createTaskWithTimeout(
    () => ipc.invoke(name),
    `callChannel call to ${name}`
  )();
}
