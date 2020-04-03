/* global window, setTimeout, clearTimeout, IDBKeyRange, dcodeIO */

const electron = require('electron');

// TODO: this results in poor readability, would be
// much better to explicitly call with `_`.
const {
  cloneDeep,
  forEach,
  get,
  isFunction,
  isObject,
  map,
  set,
  omit,
  isArrayBuffer,
} = require('lodash');

const _ = require('lodash');

const { base64ToArrayBuffer, arrayBufferToBase64 } = require('./crypto');
const MessageType = require('./types/message');

const { ipcRenderer } = electron;

// We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
//   any warnings that might be sent to the console in that case.
ipcRenderer.setMaxListeners(0);

const DATABASE_UPDATE_TIMEOUT = 2 * 60 * 1000; // two minutes

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

const _jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback = null;
let _shutdownPromise = null;

const channels = {};

module.exports = {
  _jobs,
  _cleanData,

  shutdown,
  close,
  removeDB,
  removeIndexedDBFiles,
  getPasswordHash,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  createOrUpdatePreKey,
  getPreKeyById,
  getPreKeyByRecipient,
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

  createOrUpdateContactPreKey,
  getContactPreKeyById,
  getContactPreKeyByIdentityKey,
  getContactPreKeys,
  getAllContactPreKeys,
  bulkAddContactPreKeys,
  removeContactPreKeyByIdentityKey,
  removeAllContactPreKeys,

  createOrUpdateContactSignedPreKey,
  getContactSignedPreKeyById,
  getContactSignedPreKeyByIdentityKey,
  getContactSignedPreKeys,
  bulkAddContactSignedPreKeys,
  removeContactSignedPreKeyByIdentityKey,
  removeAllContactSignedPreKeys,

  createOrUpdatePairingAuthorisation,
  removePairingAuthorisationForSecondaryPubKey,
  getGrantAuthorisationForSecondaryPubKey,
  getAuthorisationForSecondaryPubKey,
  getGrantAuthorisationsForPrimaryPubKey,
  getSecondaryDevicesFor,
  getPrimaryDeviceFor,
  getPairedDevicesFor,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  getSessionById,
  getSessionsByNumber,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByNumber,
  removeAllSessions,
  getAllSessions,

  getSwarmNodesByPubkey,

  getConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  removeConversation,
  _removeConversations,

  getAllConversations,
  getPubKeysWithFriendStatus,
  getConversationsWithFriendStatus,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllRssFeedConversations,
  getAllPublicConversations,
  getPublicConversationsByServer,
  getPubkeysInPublicConversation,
  savePublicServerToken,
  getPublicServerTokenByServerUrl,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  cleanSeenMessages,
  cleanLastHashes,
  saveSeenMessageHash,
  updateLastHash,
  saveSeenMessageHashes,
  saveLegacyMessage,
  saveMessages,
  removeMessage,
  _removeMessages,
  getUnreadByConversation,

  removeAllMessagesInConversation,

  getMessageBySender,
  getMessageByServerId,
  getMessageById,
  getAllMessages,
  getAllUnsentMessages,
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
  saveUnprocesseds,
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
  removeAllConfiguration,
  removeAllConversations,
  removeAllPrivateConversations,

  removeOtherData,
  cleanupOrphanedAttachments,

  // Returning plain JSON
  getMessagesNeedingUpgrade,
  getLegacyMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
};

// When IPC arguments are prepared for the cross-process send, they are JSON.stringified.
// We can't send ArrayBuffers or BigNumbers (what we get from proto library for dates).
function _cleanData(data) {
  const keys = Object.keys(data);
  for (let index = 0, max = keys.length; index < max; index += 1) {
    const key = keys[index];
    const value = data[key];

    if (value === null || value === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (isFunction(value.toNumber)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.toNumber();
    } else if (Array.isArray(value)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.map(item => _cleanData(item));
    } else if (isObject(value)) {
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
  window.log.info(
    `data.shutdown: starting process. ${jobKeys.length} jobs outstanding`
  );

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0) {
    return null;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise((resolve, reject) => {
    _shutdownCallback = error => {
      window.log.info('data.shutdown: process complete');
      if (error) {
        return reject(error);
      }

      return resolve();
    };
  });

  return _shutdownPromise;
}

function _makeJob(fnName) {
  if (_shuttingDown && fnName !== 'close') {
    throw new Error(
      `Rejecting SQL channel job (${fnName}); application is shutting down`
    );
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

function _updateJob(id, data) {
  const { resolve, reject } = data;
  const { fnName, start } = _jobs[id];

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: value => {
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
    reject: error => {
      _removeJob(id);
      const end = Date.now();
      window.log.warn(
        `SQL channel job ${id} (${fnName}) failed in ${end - start}ms`
      );
      return reject(error);
    },
  };
}

function _removeJob(id) {
  if (_DEBUG) {
    _jobs[id].complete = true;
    return;
  }

  if (_jobs[id].timer) {
    clearTimeout(_jobs[id].timer);
    _jobs[id].timer = null;
  }

  delete _jobs[id];

  if (_shutdownCallback) {
    const keys = Object.keys(_jobs);
    if (keys.length === 0) {
      _shutdownCallback();
    }
  }
}

function _getJob(id) {
  return _jobs[id];
}

ipcRenderer.on(
  `${SQL_CHANNEL_KEY}-done`,
  (event, jobId, errorForDisplay, result) => {
    const job = _getJob(jobId);
    if (!job) {
      throw new Error(
        `Received SQL channel reply to job ${jobId}, but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (errorForDisplay) {
      return reject(
        new Error(
          `Error received from SQL channel job ${jobId} (${fnName}): ${errorForDisplay}`
        )
      );
    }

    return resolve(result);
  }
);

function makeChannel(fnName) {
  channels[fnName] = (...args) => {
    const jobId = _makeJob(fnName);

    return new Promise((resolve, reject) => {
      ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);

      _updateJob(jobId, {
        resolve,
        reject,
        args: _DEBUG ? args : null,
      });

      _jobs[jobId].timer = setTimeout(
        () =>
          reject(new Error(`SQL channel job ${jobId} (${fnName}) timed out`)),
        DATABASE_UPDATE_TIMEOUT
      );
    });
  };
}

forEach(module.exports, fn => {
  if (isFunction(fn)) {
    makeChannel(fn.name);
  }
});

function keysToArrayBuffer(keys, data) {
  const updated = cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, base64ToArrayBuffer(value));
    }
  }

  return updated;
}

function keysFromArrayBuffer(keys, data) {
  const updated = cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
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

// Password hash

async function getPasswordHash() {
  return channels.getPasswordHash();
}

// Identity Keys

const IDENTITY_KEY_KEYS = ['publicKey'];
async function createOrUpdateIdentityKey(data) {
  const updated = keysFromArrayBuffer(IDENTITY_KEY_KEYS, data);
  await channels.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(id) {
  const data = await channels.getIdentityKeyById(id);
  return keysToArrayBuffer(IDENTITY_KEY_KEYS, data);
}
async function bulkAddIdentityKeys(array) {
  const updated = map(array, data =>
    keysFromArrayBuffer(IDENTITY_KEY_KEYS, data)
  );
  await channels.bulkAddIdentityKeys(updated);
}
async function removeIdentityKeyById(id) {
  await channels.removeIdentityKeyById(id);
}
async function removeAllIdentityKeys() {
  await channels.removeAllIdentityKeys();
}
async function getAllIdentityKeys() {
  const keys = await channels.getAllIdentityKeys();
  return keys.map(key => keysToArrayBuffer(IDENTITY_KEY_KEYS, key));
}

// Pre Keys

async function createOrUpdatePreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdatePreKey(updated);
}
async function getPreKeyById(id) {
  const data = await channels.getPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getPreKeyByRecipient(recipient) {
  const data = await channels.getPreKeyByRecipient(recipient);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function bulkAddPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddPreKeys(updated);
}
async function removePreKeyById(id) {
  await channels.removePreKeyById(id);
}
async function removeAllPreKeys() {
  await channels.removeAllPreKeys();
}
async function getAllPreKeys() {
  const keys = await channels.getAllPreKeys();
  return keys.map(key => keysToArrayBuffer(PRE_KEY_KEYS, key));
}

// Signed Pre Keys

const PRE_KEY_KEYS = ['privateKey', 'publicKey', 'signature'];
async function createOrUpdateSignedPreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(id) {
  const data = await channels.getSignedPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getAllSignedPreKeys() {
  const keys = await channels.getAllSignedPreKeys();
  return keys.map(key => keysToArrayBuffer(PRE_KEY_KEYS, key));
}
async function bulkAddSignedPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddSignedPreKeys(updated);
}
async function removeSignedPreKeyById(id) {
  await channels.removeSignedPreKeyById(id);
}
async function removeAllSignedPreKeys() {
  await channels.removeAllSignedPreKeys();
}

// Contact Pre Key
async function createOrUpdateContactPreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdateContactPreKey(updated);
}
async function getContactPreKeyById(id) {
  const data = await channels.getContactPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getContactPreKeyByIdentityKey(key) {
  const data = await channels.getContactPreKeyByIdentityKey(key);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getContactPreKeys(keyId, identityKeyString) {
  const keys = await channels.getContactPreKeys(keyId, identityKeyString);
  return keys.map(k => keysToArrayBuffer(PRE_KEY_KEYS, k));
}
async function getAllContactPreKeys() {
  const keys = await channels.getAllContactPreKeys();
  return keys;
}
async function bulkAddContactPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddContactPreKeys(updated);
}
async function removeContactPreKeyByIdentityKey(id) {
  await channels.removeContactPreKeyByIdentityKey(id);
}
async function removeAllContactPreKeys() {
  await channels.removeAllContactPreKeys();
}

// Contact Signed Pre Key
async function createOrUpdateContactSignedPreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdateContactSignedPreKey(updated);
}
async function getContactSignedPreKeyById(id) {
  const data = await channels.getContactSignedPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getContactSignedPreKeyByIdentityKey(key) {
  const data = await channels.getContactSignedPreKeyByIdentityKey(key);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getContactSignedPreKeys(keyId, identityKeyString) {
  const keys = await channels.getContactSignedPreKeys(keyId, identityKeyString);
  return keys.map(k => keysToArrayBuffer(PRE_KEY_KEYS, k));
}
async function bulkAddContactSignedPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddContactSignedPreKeys(updated);
}
async function removeContactSignedPreKeyByIdentityKey(id) {
  await channels.removeContactSignedPreKeyByIdentityKey(id);
}
async function removeAllContactSignedPreKeys() {
  await channels.removeAllContactSignedPreKeys();
}

function signatureToBase64(signature) {
  if (signature.constructor === dcodeIO.ByteBuffer) {
    return dcodeIO.ByteBuffer.wrap(signature).toString('base64');
  } else if (isArrayBuffer(signature)) {
    return arrayBufferToBase64(signature);
  } else if (typeof signature === 'string') {
    // assume it's already base64
    return signature;
  }
  throw new Error(
    'Invalid signature provided in createOrUpdatePairingAuthorisation. Needs to be either ArrayBuffer or ByteBuffer.'
  );
}

async function createOrUpdatePairingAuthorisation(data) {
  const { requestSignature, grantSignature } = data;

  return channels.createOrUpdatePairingAuthorisation({
    ...data,
    requestSignature: signatureToBase64(requestSignature),
    grantSignature: grantSignature ? signatureToBase64(grantSignature) : null,
  });
}

async function removePairingAuthorisationForSecondaryPubKey(pubKey) {
  if (!pubKey) {
    return;
  }
  await channels.removePairingAuthorisationForSecondaryPubKey(pubKey);
}

async function getGrantAuthorisationForSecondaryPubKey(pubKey) {
  return channels.getAuthorisationForSecondaryPubKey(pubKey, {
    granted: true,
  });
}

async function getGrantAuthorisationsForPrimaryPubKey(pubKey) {
  return channels.getGrantAuthorisationsForPrimaryPubKey(pubKey);
}

function getAuthorisationForSecondaryPubKey(pubKey) {
  return channels.getAuthorisationForSecondaryPubKey(pubKey);
}

function getSecondaryDevicesFor(primaryDevicePubKey) {
  return channels.getSecondaryDevicesFor(primaryDevicePubKey);
}

function getPrimaryDeviceFor(secondaryDevicePubKey) {
  return channels.getPrimaryDeviceFor(secondaryDevicePubKey);
}

function getPairedDevicesFor(pubKey) {
  return channels.getPairedDevicesFor(pubKey);
}

// Items

const ITEM_KEYS = {
  identityKey: ['value.pubKey', 'value.privKey'],
  senderCertificate: [
    'value.certificate',
    'value.signature',
    'value.serialized',
  ],
  signaling_key: ['value'],
  profileKey: ['value'],
};
async function createOrUpdateItem(data) {
  const { id } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateItem: Provided data did not have a truthy id'
    );
  }

  const keys = ITEM_KEYS[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}
async function getItemById(id) {
  const keys = ITEM_KEYS[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}
async function getAllItems() {
  const items = await channels.getAllItems();
  return map(items, item => {
    const { id } = item;
    const keys = ITEM_KEYS[id];
    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}
async function bulkAddItems(array) {
  const updated = map(array, data => {
    const { id } = data;
    const keys = ITEM_KEYS[id];
    return Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;
  });
  await channels.bulkAddItems(updated);
}
async function removeItemById(id) {
  await channels.removeItemById(id);
}
async function removeAllItems() {
  await channels.removeAllItems();
}

// Sessions

async function createOrUpdateSession(data) {
  await channels.createOrUpdateSession(data);
}
async function getSessionById(id) {
  const session = await channels.getSessionById(id);
  return session;
}
async function getSessionsByNumber(number) {
  const sessions = await channels.getSessionsByNumber(number);
  return sessions;
}
async function bulkAddSessions(array) {
  await channels.bulkAddSessions(array);
}
async function removeSessionById(id) {
  await channels.removeSessionById(id);
}
async function removeSessionsByNumber(number) {
  await channels.removeSessionsByNumber(number);
}
async function removeAllSessions(id) {
  await channels.removeAllSessions(id);
}
async function getAllSessions(id) {
  const sessions = await channels.getAllSessions(id);
  return sessions;
}

// Conversation

async function getSwarmNodesByPubkey(pubkey) {
  return channels.getSwarmNodesByPubkey(pubkey);
}

async function getConversationCount() {
  return channels.getConversationCount();
}

async function saveConversation(data) {
  const cleaned = omit(data, 'isOnline');
  await channels.saveConversation(cleaned);
}

async function saveConversations(data) {
  const cleaned = data.map(d => omit(d, 'isOnline'));
  await channels.saveConversations(cleaned);
}

async function getConversationById(id, { Conversation }) {
  const data = await channels.getConversationById(id);
  return new Conversation(data);
}

async function updateConversation(id, data, { Conversation }) {
  const existing = await getConversationById(id, { Conversation });
  if (!existing) {
    throw new Error(`Conversation ${id} does not exist!`);
  }

  const merged = _.merge({}, existing.attributes, data);

  // Merging is a really bad idea and not what we want here, e.g.
  // it will take a union of old and new members and that's not
  // what we want for member deletion, so:
  merged.members = data.members;
  merged.swarmNodes = data.swarmNodes;

  // Don't save the online status of the object
  const cleaned = omit(merged, 'isOnline');
  await channels.updateConversation(cleaned);
}

async function removeConversation(id, { Conversation }) {
  const existing = await getConversationById(id, { Conversation });

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await existing.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeConversations(ids) {
  await channels.removeConversation(ids);
}

async function getConversationsWithFriendStatus(
  status,
  { ConversationCollection }
) {
  const conversations = await channels.getConversationsWithFriendStatus(status);

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getPubKeysWithFriendStatus(status) {
  const conversations = await getConversationsWithFriendStatus(status);
  return conversations.map(row => row.id);
}

async function getAllConversations({ ConversationCollection }) {
  const conversations = await channels.getAllConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllConversationIds() {
  const ids = await channels.getAllConversationIds();
  return ids;
}

async function getAllRssFeedConversations({ ConversationCollection }) {
  const conversations = await channels.getAllRssFeedConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllPublicConversations({ ConversationCollection }) {
  const conversations = await channels.getAllPublicConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllPrivateConversations({ ConversationCollection }) {
  const conversations = await channels.getAllPrivateConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getPubkeysInPublicConversation(id) {
  return channels.getPubkeysInPublicConversation(id);
}

async function savePublicServerToken(data) {
  await channels.savePublicServerToken(data);
}

async function getPublicServerTokenByServerUrl(serverUrl) {
  const token = await channels.getPublicServerTokenByServerUrl(serverUrl);
  return token;
}

async function getPublicConversationsByServer(
  server,
  { ConversationCollection }
) {
  const conversations = await channels.getPublicConversationsByServer(server);

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllGroupsInvolvingId(id, { ConversationCollection }) {
  const conversations = await channels.getAllGroupsInvolvingId(id);

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function searchConversations(query) {
  const conversations = await channels.searchConversations(query);
  return conversations;
}

async function searchMessages(query, { limit } = {}) {
  const messages = await channels.searchMessages(query, { limit });
  return messages;
}

async function searchMessagesInConversation(
  query,
  conversationId,
  { limit } = {}
) {
  const messages = await channels.searchMessagesInConversation(
    query,
    conversationId,
    { limit }
  );
  return messages;
}

// Message
async function getMessageCount() {
  return channels.getMessageCount();
}

async function cleanSeenMessages() {
  await channels.cleanSeenMessages();
}

async function cleanLastHashes() {
  await channels.cleanLastHashes();
}

async function saveSeenMessageHashes(data) {
  await channels.saveSeenMessageHashes(_cleanData(data));
}

async function updateLastHash(data) {
  await channels.updateLastHash(_cleanData(data));
}

async function saveSeenMessageHash(data) {
  await channels.saveSeenMessageHash(_cleanData(data));
}

async function saveMessage(data, { forceSave, Message } = {}) {
  const id = await channels.saveMessage(_cleanData(data), { forceSave });
  Message.refreshExpirationTimer();
  return id;
}

async function saveLegacyMessage(data) {
  const db = await window.Whisper.Database.open();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readwrite');

      transaction.onerror = () => {
        window.Whisper.Database.handleDOMException(
          'saveLegacyMessage transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = resolve;

      const store = transaction.objectStore('messages');

      if (!data.id) {
        // eslint-disable-next-line no-param-reassign
        data.id = window.getGuid();
      }

      const request = store.put(data, data.id);
      request.onsuccess = resolve;
      request.onerror = () => {
        window.Whisper.Database.handleDOMException(
          'saveLegacyMessage request error',
          request.error,
          reject
        );
      };
    });
  } finally {
    db.close();
  }
}

async function saveMessages(arrayOfMessages, { forceSave } = {}) {
  await channels.saveMessages(_cleanData(arrayOfMessages), { forceSave });
}

async function removeMessage(id, { Message }) {
  const message = await getMessageById(id, { Message });

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (message) {
    await channels.removeMessage(id);
    await message.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeMessages(ids) {
  await channels.removeMessage(ids);
}

async function getMessageByServerId(serverId, conversationId, { Message }) {
  const message = await channels.getMessageByServerId(serverId, conversationId);
  if (!message) {
    return null;
  }

  return new Message(message);
}

async function getMessageById(id, { Message }) {
  const message = await channels.getMessageById(id);
  if (!message) {
    return null;
  }

  return new Message(message);
}

// For testing only
async function getAllMessages({ MessageCollection }) {
  const messages = await channels.getAllMessages();
  return new MessageCollection(messages);
}

async function getAllUnsentMessages({ MessageCollection }) {
  const messages = await channels.getAllUnsentMessages();
  return new MessageCollection(messages);
}

async function getAllMessageIds() {
  const ids = await channels.getAllMessageIds();
  return ids;
}

async function getMessageBySender(
  // eslint-disable-next-line camelcase
  { source, sourceDevice, sent_at },
  { Message }
) {
  const messages = await channels.getMessageBySender({
    source,
    sourceDevice,
    sent_at,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new Message(messages[0]);
}

async function getUnreadByConversation(conversationId, { MessageCollection }) {
  const messages = await channels.getUnreadByConversation(conversationId);
  return new MessageCollection(messages);
}

async function getMessagesByConversation(
  conversationId,
  { limit = 100, receivedAt = Number.MAX_VALUE, MessageCollection, type = '%' }
) {
  const messages = await channels.getMessagesByConversation(conversationId, {
    limit,
    receivedAt,
    type,
  });

  return new MessageCollection(messages);
}

async function getLastHashBySnode(snode) {
  return channels.getLastHashBySnode(snode);
}

async function getSeenMessagesByHashList(hashes) {
  return channels.getSeenMessagesByHashList(hashes);
}

async function removeAllMessagesInConversation(
  conversationId,
  { MessageCollection }
) {
  let messages;
  do {
    // Yes, we really want the await in the loop. We're deleting 100 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    messages = await getMessagesByConversation(conversationId, {
      limit: 100,
      MessageCollection,
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

async function getMessagesBySentAt(sentAt, { MessageCollection }) {
  const messages = await channels.getMessagesBySentAt(sentAt);
  return new MessageCollection(messages);
}

async function getExpiredMessages({ MessageCollection }) {
  const messages = await channels.getExpiredMessages();
  return new MessageCollection(messages);
}

async function getOutgoingWithoutExpiresAt({ MessageCollection }) {
  const messages = await channels.getOutgoingWithoutExpiresAt();
  return new MessageCollection(messages);
}

async function getNextExpiringMessage({ MessageCollection }) {
  const messages = await channels.getNextExpiringMessage();
  return new MessageCollection(messages);
}

// Unprocessed

async function getUnprocessedCount() {
  return channels.getUnprocessedCount();
}

async function getAllUnprocessed() {
  return channels.getAllUnprocessed();
}

async function getUnprocessedById(id) {
  return channels.getUnprocessedById(id);
}

async function saveUnprocessed(data, { forceSave } = {}) {
  const id = await channels.saveUnprocessed(_cleanData(data), { forceSave });
  return id;
}

async function saveUnprocesseds(arrayOfUnprocessed, { forceSave } = {}) {
  await channels.saveUnprocesseds(_cleanData(arrayOfUnprocessed), {
    forceSave,
  });
}

async function updateUnprocessedAttempts(id, attempts) {
  await channels.updateUnprocessedAttempts(id, attempts);
}
async function updateUnprocessedWithData(id, data) {
  await channels.updateUnprocessedWithData(id, data);
}

async function removeUnprocessed(id) {
  await channels.removeUnprocessed(id);
}

async function removeAllUnprocessed() {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

async function getNextAttachmentDownloadJobs(limit) {
  return channels.getNextAttachmentDownloadJobs(limit);
}
async function saveAttachmentDownloadJob(job) {
  await channels.saveAttachmentDownloadJob(job);
}
async function setAttachmentDownloadJobPending(id, pending) {
  await channels.setAttachmentDownloadJobPending(id, pending);
}
async function resetAttachmentDownloadPending() {
  await channels.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id) {
  await channels.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs() {
  await channels.removeAllAttachmentDownloadJobs();
}

// Other

async function removeAll() {
  await channels.removeAll();
}

async function removeAllConfiguration() {
  await channels.removeAllConfiguration();
}

async function removeAllConversations() {
  await channels.removeAllConversations();
}

async function removeAllPrivateConversations() {
  await channels.removeAllPrivateConversations();
}

async function cleanupOrphanedAttachments() {
  await callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData() {
  await Promise.all([
    callChannel(ERASE_SQL_KEY),
    callChannel(ERASE_ATTACHMENTS_KEY),
  ]);
}

async function callChannel(name) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send(name);
    ipcRenderer.once(`${name}-done`, (event, error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });

    setTimeout(
      () => reject(new Error(`callChannel call to ${name} timed out`)),
      DATABASE_UPDATE_TIMEOUT
    );
  });
}

// Functions below here return plain JSON instead of Backbone Models

async function getLegacyMessagesNeedingUpgrade(
  limit,
  { maxVersion = MessageType.CURRENT_SCHEMA_VERSION }
) {
  const db = await window.Whisper.Database.open();
  try {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readonly');
      const messages = [];

      transaction.onerror = () => {
        window.Whisper.Database.handleDOMException(
          'getLegacyMessagesNeedingUpgrade transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = () => {
        resolve(messages);
      };

      const store = transaction.objectStore('messages');
      const index = store.index('schemaVersion');
      const range = IDBKeyRange.upperBound(maxVersion, true);

      const request = index.openCursor(range);
      let count = 0;

      request.onsuccess = event => {
        const cursor = event.target.result;

        if (cursor) {
          count += 1;
          messages.push(cursor.value);

          if (count >= limit) {
            return;
          }

          cursor.continue();
        }
      };
      request.onerror = () => {
        window.Whisper.Database.handleDOMException(
          'getLegacyMessagesNeedingUpgrade request error',
          request.error,
          reject
        );
      };
    });
  } finally {
    db.close();
  }
}

async function getMessagesNeedingUpgrade(
  limit,
  { maxVersion = MessageType.CURRENT_SCHEMA_VERSION }
) {
  const messages = await channels.getMessagesNeedingUpgrade(limit, {
    maxVersion,
  });

  return messages;
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit }
) {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit,
  });
}

async function getMessagesWithFileAttachments(conversationId, { limit }) {
  return channels.getMessagesWithFileAttachments(conversationId, {
    limit,
  });
}
