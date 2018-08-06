/* global window, setTimeout */

const electron = require('electron');
const { forEach, isFunction, isObject } = require('lodash');

const { deferredToPromise } = require('./deferred_to_promise');
const MessageType = require('./types/message');

const { ipcRenderer } = electron;

// We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
//   any warnings that might be sent to the console in that case.
ipcRenderer.setMaxListeners(0);

// calls to search for when finding functions to convert:
//   .fetch(
//   .save(
//   .destroy(

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';

const _jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;

const channels = {};

module.exports = {
  _jobs,
  _cleanData,

  close,
  removeDB,

  getMessageCount,
  saveMessage,
  saveLegacyMessage,
  saveMessages,
  removeMessage,
  _removeMessages,
  getUnreadByConversation,

  removeAllMessagesInConversation,

  getMessageBySender,
  getMessageById,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getNextExpiringMessage,
  getMessagesByConversation,

  getAllUnprocessed,
  getUnprocessedById,
  saveUnprocessed,
  saveUnprocesseds,
  updateUnprocessed,
  removeUnprocessed,
  removeAllUnprocessed,

  removeAll,
  removeOtherData,

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

function _makeJob(fnName) {
  _jobCounter += 1;
  const id = _jobCounter;

  _jobs[id] = {
    fnName,
  };

  return id;
}

function _updateJob(id, data) {
  const { resolve, reject } = data;

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: value => {
      _removeJob(id);
      return resolve(value);
    },
    reject: error => {
      _removeJob(id);
      return reject(error);
    },
  };
}

function _removeJob(id) {
  if (_DEBUG) {
    _jobs[id].complete = true;
  } else {
    delete _jobs[id];
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
        `Received job reply to job ${jobId}, but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (errorForDisplay) {
      return reject(
        new Error(`Error calling channel ${fnName}: ${errorForDisplay}`)
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

      setTimeout(
        () => reject(new Error(`Request to ${fnName} timed out`)),
        10000
      );
    });
  };
}

forEach(module.exports, fn => {
  if (isFunction(fn)) {
    makeChannel(fn.name);
  }
});

// Note: will need to restart the app after calling this, to set up afresh
async function close() {
  await channels.close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeDB() {
  await channels.removeDB();
}

async function getMessageCount() {
  return channels.getMessageCount();
}

async function saveMessage(data, { forceSave, Message } = {}) {
  const id = await channels.saveMessage(_cleanData(data), { forceSave });
  Message.refreshExpirationTimer();
  return id;
}

async function saveLegacyMessage(data, { Message }) {
  const message = new Message(data);
  await deferredToPromise(message.save());
  return message.id;
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
    const model = new Message(message);
    await model.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeMessages(ids) {
  await channels.removeMessage(ids);
}

async function getMessageById(id, { Message }) {
  const message = await channels.getMessageById(id);
  return new Message(message);
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
  { limit = 100, receivedAt = Number.MAX_VALUE, MessageCollection }
) {
  const messages = await channels.getMessagesByConversation(conversationId, {
    limit,
    receivedAt,
  });

  return new MessageCollection(messages);
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
  window.log.info('Load expired messages');
  const messages = await channels.getExpiredMessages();
  return new MessageCollection(messages);
}

async function getNextExpiringMessage({ MessageCollection }) {
  const messages = await channels.getNextExpiringMessage();
  return new MessageCollection(messages);
}

async function getAllUnprocessed() {
  return channels.getAllUnprocessed();
}

async function getUnprocessedById(id, { Unprocessed }) {
  const unprocessed = await channels.getUnprocessedById(id);
  return new Unprocessed(unprocessed);
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

async function updateUnprocessed(id, updates) {
  const existing = await channels.getUnprocessedById(id);
  if (!existing) {
    throw new Error(`Unprocessed id ${id} does not exist in the database!`);
  }
  const toSave = {
    ...existing,
    ...updates,
  };

  await saveUnprocessed(toSave);
}

async function removeUnprocessed(id) {
  await channels.removeUnprocessed(id);
}

async function removeAllUnprocessed() {
  await channels.removeAllUnprocessed();
}

async function removeAll() {
  await channels.removeAll();
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
      5000
    );
  });
}

// Functions below here return JSON

async function getLegacyMessagesNeedingUpgrade(
  limit,
  { MessageCollection, maxVersion = MessageType.CURRENT_SCHEMA_VERSION }
) {
  const messages = new MessageCollection();

  await deferredToPromise(
    messages.fetch({
      limit,
      index: {
        name: 'schemaVersion',
        upper: maxVersion,
        excludeUpper: true,
        order: 'desc',
      },
    })
  );

  const models = messages.models || [];
  return models.map(model => model.toJSON());
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
