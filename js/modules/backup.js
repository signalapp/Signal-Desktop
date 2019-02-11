/* global Signal: false */
/* global Whisper: false */
/* global _: false */
/* global textsecure: false */
/* global i18n: false */

/* eslint-env browser */
/* eslint-env node */

/* eslint-disable no-param-reassign, guard-for-in */

const fs = require('fs');
const path = require('path');

const { map, fromPairs } = require('lodash');
const tar = require('tar');
const tmp = require('tmp');
const pify = require('pify');
const rimraf = require('rimraf');
const electronRemote = require('electron').remote;

const crypto = require('./crypto');

const { dialog, BrowserWindow } = electronRemote;

module.exports = {
  getDirectoryForExport,
  exportToDirectory,
  getDirectoryForImport,
  importFromDirectory,
  // for testing
  _sanitizeFileName,
  _trimFileName,
  _getExportAttachmentFileName,
  _getAnonymousAttachmentFileName,
  _getConversationDirName,
  _getConversationLoggingName,
};

function stringify(object) {
  // eslint-disable-next-line no-restricted-syntax
  for (const key in object) {
    const val = object[key];
    if (val instanceof ArrayBuffer) {
      object[key] = {
        type: 'ArrayBuffer',
        encoding: 'base64',
        data: crypto.arrayBufferToBase64(val),
      };
    } else if (val instanceof Object) {
      object[key] = stringify(val);
    }
  }
  return object;
}

function unstringify(object) {
  if (!(object instanceof Object)) {
    throw new Error('unstringify expects an object');
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const key in object) {
    const val = object[key];
    if (
      val &&
      val.type === 'ArrayBuffer' &&
      val.encoding === 'base64' &&
      typeof val.data === 'string'
    ) {
      object[key] = crypto.base64ToArrayBuffer(val.data);
    } else if (val instanceof Object) {
      object[key] = unstringify(object[key]);
    }
  }
  return object;
}

function createOutputStream(writer) {
  let wait = Promise.resolve();
  return {
    write(string) {
      // eslint-disable-next-line more/no-then
      wait = wait.then(
        () =>
          new Promise(resolve => {
            if (writer.write(string)) {
              resolve();
              return;
            }

            //  If write() returns true, we don't need to wait for the drain event
            //   https://nodejs.org/dist/latest-v7.x/docs/api/stream.html#stream_class_stream_writable
            writer.once('drain', resolve);

            // We don't register for the 'error' event here, only in close(). Otherwise,
            //   we'll get "Possible EventEmitter memory leak detected" warnings.
          })
      );
      return wait;
    },
    async close() {
      await wait;
      return new Promise((resolve, reject) => {
        writer.once('finish', resolve);
        writer.once('error', reject);
        writer.end();
      });
    },
  };
}

async function exportConversationListToFile(parent) {
  const writer = await createFileAndWriter(parent, 'db.json');
  return exportConversationList(writer);
}

function writeArray(stream, array) {
  stream.write('[');

  for (let i = 0, max = array.length; i < max; i += 1) {
    if (i > 0) {
      stream.write(',');
    }

    const item = array[i];

    // We don't back up avatars; we'll get them in a future contact sync or profile fetch
    const cleaned = _.omit(item, ['avatar', 'profileAvatar']);

    stream.write(JSON.stringify(stringify(cleaned)));
  }

  stream.write(']');
}

function getPlainJS(collection) {
  return collection.map(model => model.attributes);
}

async function exportConversationList(fileWriter) {
  const stream = createOutputStream(fileWriter);

  stream.write('{');

  stream.write('"conversations": ');
  const conversations = await window.Signal.Data.getAllConversations({
    ConversationCollection: Whisper.ConversationCollection,
  });
  window.log.info(`Exporting ${conversations.length} conversations`);
  writeArray(stream, getPlainJS(conversations));

  stream.write('}');
  await stream.close();
}

async function importNonMessages(parent, options) {
  const file = 'db.json';
  const string = await readFileAsText(parent, file);
  return importFromJsonString(string, path.join(parent, file), options);
}

function eliminateClientConfigInBackup(data, targetPath) {
  const cleaned = _.pick(data, 'conversations');
  window.log.info('Writing configuration-free backup file back to disk');
  try {
    fs.writeFileSync(targetPath, JSON.stringify(cleaned));
  } catch (error) {
    window.log.error('Error writing cleaned-up backup to disk: ', error.stack);
  }
}

async function importConversationsFromJSON(conversations, options) {
  const { writeNewAttachmentData } = window.Signal.Migrations;
  const { conversationLookup } = options;

  let count = 0;
  let skipCount = 0;

  for (let i = 0, max = conversations.length; i < max; i += 1) {
    const toAdd = unstringify(conversations[i]);
    const haveConversationAlready =
      conversationLookup[getConversationKey(toAdd)];

    if (haveConversationAlready) {
      skipCount += 1;
      count += 1;
      // eslint-disable-next-line no-continue
      continue;
    }

    count += 1;
    // eslint-disable-next-line no-await-in-loop
    const migrated = await window.Signal.Types.Conversation.migrateConversation(
      toAdd,
      {
        writeNewAttachmentData,
      }
    );
    // eslint-disable-next-line no-await-in-loop
    await window.Signal.Data.saveConversation(migrated, {
      Conversation: Whisper.Conversation,
    });
  }

  window.log.info(
    'Done importing conversations:',
    'Total count:',
    count,
    'Skipped:',
    skipCount
  );
}

async function importFromJsonString(jsonString, targetPath, options) {
  options = options || {};
  _.defaults(options, {
    forceLightImport: false,
    conversationLookup: {},
  });

  const result = {
    fullImport: true,
  };

  const importObject = JSON.parse(jsonString);
  delete importObject.debug;

  if (!importObject.sessions || options.forceLightImport) {
    result.fullImport = false;

    delete importObject.items;
    delete importObject.signedPreKeys;
    delete importObject.preKeys;
    delete importObject.identityKeys;
    delete importObject.sessions;
    delete importObject.unprocessed;

    window.log.info(
      'This is a light import; contacts, groups and messages only'
    );
  }

  // We mutate the on-disk backup to prevent the user from importing client
  //   configuration more than once - that causes lots of encryption errors.
  //   This of course preserves the true data: conversations.
  eliminateClientConfigInBackup(importObject, targetPath);

  const storeNames = _.keys(importObject);
  window.log.info('Importing to these stores:', storeNames.join(', '));

  // Special-case conversations key here, going to SQLCipher
  const { conversations } = importObject;
  const remainingStoreNames = _.without(
    storeNames,
    'conversations',
    'unprocessed',
    'groups' // in old data sets, but no longer included in database schema
  );
  await importConversationsFromJSON(conversations, options);

  const SAVE_FUNCTIONS = {
    identityKeys: window.Signal.Data.createOrUpdateIdentityKey,
    items: window.Signal.Data.createOrUpdateItem,
    preKeys: window.Signal.Data.createOrUpdatePreKey,
    sessions: window.Signal.Data.createOrUpdateSession,
    signedPreKeys: window.Signal.Data.createOrUpdateSignedPreKey,
  };

  await Promise.all(
    _.map(remainingStoreNames, async storeName => {
      const save = SAVE_FUNCTIONS[storeName];
      if (!_.isFunction(save)) {
        throw new Error(
          `importFromJsonString: Didn't have save function for store ${storeName}`
        );
      }

      window.log.info(`Importing items for store ${storeName}`);
      const toImport = importObject[storeName];

      if (!toImport || !toImport.length) {
        window.log.info(`No items in ${storeName} store`);
        return;
      }

      for (let i = 0, max = toImport.length; i < max; i += 1) {
        const toAdd = unstringify(toImport[i]);
        // eslint-disable-next-line no-await-in-loop
        await save(toAdd);
      }

      window.log.info(
        'Done importing to store',
        storeName,
        'Total count:',
        toImport.length
      );
    })
  );

  window.log.info('DB import complete');
  return result;
}

function createDirectory(parent, name) {
  return new Promise((resolve, reject) => {
    const sanitized = _sanitizeFileName(name);
    const targetDir = path.join(parent, sanitized);
    if (fs.existsSync(targetDir)) {
      resolve(targetDir);
      return;
    }

    fs.mkdir(targetDir, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve(targetDir);
    });
  });
}

function createFileAndWriter(parent, name) {
  return new Promise(resolve => {
    const sanitized = _sanitizeFileName(name);
    const targetPath = path.join(parent, sanitized);
    const options = {
      flags: 'wx',
    };
    return resolve(fs.createWriteStream(targetPath, options));
  });
}

function readFileAsText(parent, name) {
  return new Promise((resolve, reject) => {
    const targetPath = path.join(parent, name);
    fs.readFile(targetPath, 'utf8', (error, string) => {
      if (error) {
        return reject(error);
      }

      return resolve(string);
    });
  });
}

// Buffer instances are also Uint8Array instances, but they might be a view
//   https://nodejs.org/docs/latest/api/buffer.html#buffer_buffers_and_typedarray
const toArrayBuffer = nodeBuffer =>
  nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength
  );

function readFileAsArrayBuffer(targetPath) {
  return new Promise((resolve, reject) => {
    // omitting the encoding to get a buffer back
    fs.readFile(targetPath, (error, buffer) => {
      if (error) {
        return reject(error);
      }

      return resolve(toArrayBuffer(buffer));
    });
  });
}

function _trimFileName(filename) {
  const components = filename.split('.');
  if (components.length <= 1) {
    return filename.slice(0, 30);
  }

  const extension = components[components.length - 1];
  const name = components.slice(0, components.length - 1);
  if (extension.length > 5) {
    return filename.slice(0, 30);
  }

  return `${name.join('.').slice(0, 24)}.${extension}`;
}

function _getExportAttachmentFileName(message, index, attachment) {
  if (attachment.fileName) {
    return _trimFileName(attachment.fileName);
  }

  let name = attachment.id;

  if (attachment.contentType) {
    const components = attachment.contentType.split('/');
    name += `.${
      components.length > 1 ? components[1] : attachment.contentType
    }`;
  }

  return name;
}

function _getAnonymousAttachmentFileName(message, index) {
  if (!index) {
    return message.id;
  }
  return `${message.id}-${index}`;
}

async function readEncryptedAttachment(dir, attachment, name, options) {
  options = options || {};
  const { key } = options;

  const sanitizedName = _sanitizeFileName(name);
  const targetPath = path.join(dir, sanitizedName);

  if (!fs.existsSync(targetPath)) {
    window.log.warn(`Warning: attachment ${sanitizedName} not found`);
    return;
  }

  const data = await readFileAsArrayBuffer(targetPath);

  const isEncrypted = !_.isUndefined(key);

  if (isEncrypted) {
    attachment.data = await crypto.decryptAttachment(
      key,
      attachment.path,
      data
    );
  } else {
    attachment.data = data;
  }
}

async function writeQuoteThumbnail(attachment, options) {
  if (!attachment || !attachment.thumbnail || !attachment.thumbnail.path) {
    return;
  }

  const { dir, message, index, key, newKey } = options;
  const filename = `${_getAnonymousAttachmentFileName(
    message,
    index
  )}-quote-thumbnail`;
  const target = path.join(dir, filename);

  await writeEncryptedAttachment(target, attachment.thumbnail.path, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writeQuoteThumbnails(quotedAttachments, options) {
  const { name } = options;

  try {
    await Promise.all(
      _.map(quotedAttachments, (attachment, index) =>
        writeQuoteThumbnail(
          attachment,
          Object.assign({}, options, {
            index,
          })
        )
      )
    );
  } catch (error) {
    window.log.error(
      'writeThumbnails: error exporting conversation',
      name,
      ':',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function writeAttachment(attachment, options) {
  if (!_.isString(attachment.path)) {
    throw new Error('writeAttachment: attachment.path was not a string!');
  }

  const { dir, message, index, key, newKey } = options;
  const filename = _getAnonymousAttachmentFileName(message, index);
  const target = path.join(dir, filename);

  await writeEncryptedAttachment(target, attachment.path, {
    key,
    newKey,
    filename,
    dir,
  });

  if (attachment.thumbnail && _.isString(attachment.thumbnail.path)) {
    const thumbnailName = `${_getAnonymousAttachmentFileName(
      message,
      index
    )}-thumbnail`;
    const thumbnailTarget = path.join(dir, thumbnailName);
    await writeEncryptedAttachment(thumbnailTarget, attachment.thumbnail.path, {
      key,
      newKey,
      filename: thumbnailName,
      dir,
    });
  }

  if (attachment.screenshot && _.isString(attachment.screenshot.path)) {
    const screenshotName = `${_getAnonymousAttachmentFileName(
      message,
      index
    )}-screenshot`;
    const screenshotTarget = path.join(dir, screenshotName);
    await writeEncryptedAttachment(
      screenshotTarget,
      attachment.screenshot.path,
      {
        key,
        newKey,
        filename: screenshotName,
        dir,
      }
    );
  }
}

async function writeAttachments(attachments, options) {
  const { name } = options;

  const promises = _.map(attachments, (attachment, index) =>
    writeAttachment(
      attachment,
      Object.assign({}, options, {
        index,
      })
    )
  );
  try {
    await Promise.all(promises);
  } catch (error) {
    window.log.error(
      'writeAttachments: error exporting conversation',
      name,
      ':',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function writeAvatar(contact, options) {
  const { avatar } = contact || {};
  if (!avatar || !avatar.avatar || !avatar.avatar.path) {
    return;
  }

  const { dir, message, index, key, newKey } = options;
  const name = _getAnonymousAttachmentFileName(message, index);
  const filename = `${name}-contact-avatar`;
  const target = path.join(dir, filename);

  await writeEncryptedAttachment(target, avatar.avatar.path, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writeContactAvatars(contact, options) {
  const { name } = options;

  try {
    await Promise.all(
      _.map(contact, (item, index) =>
        writeAvatar(
          item,
          Object.assign({}, options, {
            index,
          })
        )
      )
    );
  } catch (error) {
    window.log.error(
      'writeContactAvatars: error exporting conversation',
      name,
      ':',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function writePreviewImage(preview, options) {
  const { image } = preview || {};
  if (!image || !image.path) {
    return;
  }

  const { dir, message, index, key, newKey } = options;
  const name = _getAnonymousAttachmentFileName(message, index);
  const filename = `${name}-preview`;
  const target = path.join(dir, filename);

  await writeEncryptedAttachment(target, image.path, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writePreviews(preview, options) {
  const { name } = options;

  try {
    await Promise.all(
      _.map(preview, (item, index) =>
        writePreviewImage(
          item,
          Object.assign({}, options, {
            index,
          })
        )
      )
    );
  } catch (error) {
    window.log.error(
      'writePreviews: error exporting conversation',
      name,
      ':',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}

async function writeEncryptedAttachment(target, source, options = {}) {
  const { key, newKey, filename, dir } = options;

  if (fs.existsSync(target)) {
    if (newKey) {
      window.log.info(`Deleting attachment ${filename}; key has changed`);
      fs.unlinkSync(target);
    } else {
      window.log.info(`Skipping attachment ${filename}; already exists`);
      return;
    }
  }

  const { readAttachmentData } = Signal.Migrations;
  const data = await readAttachmentData(source);
  const ciphertext = await crypto.encryptAttachment(key, source, data);

  const writer = await createFileAndWriter(dir, filename);
  const stream = createOutputStream(writer);
  stream.write(Buffer.from(ciphertext));
  await stream.close();
}

function _sanitizeFileName(filename) {
  return filename.toString().replace(/[^a-z0-9.,+()'#\- ]/gi, '_');
}

async function exportConversation(conversation, options = {}) {
  const { name, dir, attachmentsDir, key, newKey } = options;

  if (!name) {
    throw new Error('Need a name!');
  }
  if (!dir) {
    throw new Error('Need a target directory!');
  }
  if (!attachmentsDir) {
    throw new Error('Need an attachments directory!');
  }
  if (!key) {
    throw new Error('Need a key to encrypt with!');
  }

  window.log.info('exporting conversation', name);
  const writer = await createFileAndWriter(dir, 'messages.json');
  const stream = createOutputStream(writer);
  stream.write('{"messages":[');

  const CHUNK_SIZE = 50;
  let count = 0;
  let complete = false;

  // We're looping from the most recent to the oldest
  let lastReceivedAt = Number.MAX_VALUE;

  while (!complete) {
    // eslint-disable-next-line no-await-in-loop
    const collection = await window.Signal.Data.getMessagesByConversation(
      conversation.id,
      {
        limit: CHUNK_SIZE,
        receivedAt: lastReceivedAt,
        MessageCollection: Whisper.MessageCollection,
      }
    );
    const messages = getPlainJS(collection);

    for (let i = 0, max = messages.length; i < max; i += 1) {
      const message = messages[i];
      if (count > 0) {
        stream.write(',');
      }

      count += 1;

      // skip message if it is disappearing, no matter the amount of time left
      if (message.expireTimer) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const { attachments } = message;
      // eliminate attachment data from the JSON, since it will go to disk
      // Note: this is for legacy messages only, which stored attachment data in the db
      message.attachments = _.map(attachments, attachment =>
        _.omit(attachment, ['data'])
      );
      // completely drop any attachments in messages cached in error objects
      // TODO: move to lodash. Sadly, a number of the method signatures have changed!
      message.errors = _.map(message.errors, error => {
        if (error && error.args) {
          error.args = [];
        }
        if (error && error.stack) {
          error.stack = '';
        }
        return error;
      });

      const jsonString = JSON.stringify(stringify(message));
      stream.write(jsonString);

      if (attachments && attachments.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await writeAttachments(attachments, {
          dir: attachmentsDir,
          name,
          message,
          key,
          newKey,
        });
      }

      const quoteThumbnails = message.quote && message.quote.attachments;
      if (quoteThumbnails && quoteThumbnails.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await writeQuoteThumbnails(quoteThumbnails, {
          dir: attachmentsDir,
          name,
          message,
          key,
          newKey,
        });
      }

      const { contact } = message;
      if (contact && contact.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await writeContactAvatars(contact, {
          dir: attachmentsDir,
          name,
          message,
          key,
          newKey,
        });
      }

      const { preview } = message;
      if (preview && preview.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await writePreviews(preview, {
          dir: attachmentsDir,
          name,
          message,
          key,
          newKey,
        });
      }
    }

    const last = messages.length > 0 ? messages[messages.length - 1] : null;
    if (last) {
      lastReceivedAt = last.received_at;
    }

    if (messages.length < CHUNK_SIZE) {
      complete = true;
    }
  }

  stream.write(']}');
  await stream.close();
}

// Goals for directory names:
//   1. Human-readable, for easy use and verification by user (names not just ids)
//   2. Sorted just like the list of conversations in the left-pan (active_at)
//   3. Disambiguated from other directories (active_at, truncated name, id)
function _getConversationDirName(conversation) {
  const name = conversation.active_at || 'inactive';
  if (conversation.name) {
    return `${name} (${conversation.name.slice(0, 30)} ${conversation.id})`;
  }
  return `${name} (${conversation.id})`;
}

// Goals for logging names:
//   1. Can be associated with files on disk
//   2. Adequately disambiguated to enable debugging flow of execution
//   3. Can be shared to the web without privacy concerns (there's no global redaction
//      logic for group ids, so we do it manually here)
function _getConversationLoggingName(conversation) {
  let name = conversation.active_at || 'inactive';
  if (conversation.type === 'private') {
    name += ` (${conversation.id})`;
  } else {
    name += ` ([REDACTED_GROUP]${conversation.id.slice(-3)})`;
  }
  return name;
}

async function exportConversations(options) {
  options = options || {};
  const { messagesDir, attachmentsDir, key, newKey } = options;

  if (!messagesDir) {
    throw new Error('Need a messages directory!');
  }
  if (!attachmentsDir) {
    throw new Error('Need an attachments directory!');
  }

  const collection = await window.Signal.Data.getAllConversations({
    ConversationCollection: Whisper.ConversationCollection,
  });
  const conversations = collection.models;

  for (let i = 0, max = conversations.length; i < max; i += 1) {
    const conversation = conversations[i];
    const dirName = _getConversationDirName(conversation);
    const name = _getConversationLoggingName(conversation);

    // eslint-disable-next-line no-await-in-loop
    const dir = await createDirectory(messagesDir, dirName);
    // eslint-disable-next-line no-await-in-loop
    await exportConversation(conversation, {
      name,
      dir,
      attachmentsDir,
      key,
      newKey,
    });
  }

  window.log.info('Done exporting conversations!');
}

function getDirectory(options = {}) {
  return new Promise((resolve, reject) => {
    const browserWindow = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      title: options.title,
      properties: ['openDirectory'],
      buttonLabel: options.buttonLabel,
    };

    dialog.showOpenDialog(browserWindow, dialogOptions, directory => {
      if (!directory || !directory[0]) {
        const error = new Error('Error choosing directory');
        error.name = 'ChooseError';
        return reject(error);
      }

      return resolve(directory[0]);
    });
  });
}

function getDirContents(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (err) {
        reject(err);
        return;
      }

      files = _.map(files, file => path.join(dir, file));

      resolve(files);
    });
  });
}

async function loadAttachments(dir, getName, options) {
  options = options || {};
  const { message } = options;

  await Promise.all(
    _.map(message.attachments, async (attachment, index) => {
      const name = getName(message, index, attachment);

      await readEncryptedAttachment(dir, attachment, name, options);

      if (attachment.thumbnail && _.isString(attachment.thumbnail.path)) {
        const thumbnailName = `${name}-thumbnail`;
        await readEncryptedAttachment(
          dir,
          attachment.thumbnail,
          thumbnailName,
          options
        );
      }

      if (attachment.screenshot && _.isString(attachment.screenshot.path)) {
        const screenshotName = `${name}-screenshot`;
        await readEncryptedAttachment(
          dir,
          attachment.screenshot,
          screenshotName,
          options
        );
      }
    })
  );

  const quoteAttachments = message.quote && message.quote.attachments;
  await Promise.all(
    _.map(quoteAttachments, (attachment, index) => {
      const thumbnail = attachment && attachment.thumbnail;
      if (!thumbnail) {
        return null;
      }

      const name = `${getName(message, index)}-quote-thumbnail`;
      return readEncryptedAttachment(dir, thumbnail, name, options);
    })
  );

  const { contact } = message;
  await Promise.all(
    _.map(contact, (item, index) => {
      const avatar = item && item.avatar && item.avatar.avatar;
      if (!avatar) {
        return null;
      }

      const name = `${getName(message, index)}-contact-avatar`;
      return readEncryptedAttachment(dir, avatar, name, options);
    })
  );

  const { preview } = message;
  await Promise.all(
    _.map(preview, (item, index) => {
      const image = item && item.image;
      if (!image) {
        return null;
      }

      const name = `${getName(message, index)}-preview`;
      return readEncryptedAttachment(dir, image, name, options);
    })
  );
}

function saveMessage(message) {
  return saveAllMessages([message]);
}

async function saveAllMessages(rawMessages) {
  if (rawMessages.length === 0) {
    return;
  }

  try {
    const { writeMessageAttachments, upgradeMessageSchema } = Signal.Migrations;
    const importAndUpgrade = async message =>
      upgradeMessageSchema(await writeMessageAttachments(message));

    const messages = await Promise.all(rawMessages.map(importAndUpgrade));

    const { conversationId } = messages[0];

    await window.Signal.Data.saveMessages(messages, {
      forceSave: true,
    });

    window.log.info(
      'Saved',
      messages.length,
      'messages for conversation',
      // Don't know if group or private conversation, so we blindly redact
      `[REDACTED]${conversationId.slice(-3)}`
    );
  } catch (error) {
    window.log.error(
      'saveAllMessages error',
      error && error.message ? error.message : error
    );
  }
}

// To reduce the memory impact of attachments, we make individual saves to the
//   database for every message with an attachment. We load the attachment for a
//   message, save it, and only then do we move on to the next message. Thus, every
//   message with attachments needs to be removed from our overall message save with the
//   filter() call.
async function importConversation(dir, options) {
  options = options || {};
  _.defaults(options, { messageLookup: {} });

  const { messageLookup, attachmentsDir, key } = options;

  let conversationId = 'unknown';
  let total = 0;
  let skipped = 0;
  let contents;

  try {
    contents = await readFileAsText(dir, 'messages.json');
  } catch (error) {
    window.log.error(
      `Warning: could not access messages.json in directory: ${dir}`
    );
  }

  let promiseChain = Promise.resolve();

  const json = JSON.parse(contents);
  if (json.messages && json.messages.length) {
    conversationId = `[REDACTED]${(json.messages[0].conversationId || '').slice(
      -3
    )}`;
  }
  total = json.messages.length;

  const messages = _.filter(json.messages, message => {
    message = unstringify(message);

    if (messageLookup[getMessageKey(message)]) {
      skipped += 1;
      return false;
    }

    const hasAttachments = message.attachments && message.attachments.length;
    const hasQuotedAttachments =
      message.quote &&
      message.quote.attachments &&
      message.quote.attachments.length > 0;
    const hasContacts = message.contact && message.contact.length;
    const hasPreviews = message.preview && message.preview.length;

    if (hasAttachments || hasQuotedAttachments || hasContacts || hasPreviews) {
      const importMessage = async () => {
        const getName = attachmentsDir
          ? _getAnonymousAttachmentFileName
          : _getExportAttachmentFileName;
        const parentDir =
          attachmentsDir || path.join(dir, message.received_at.toString());

        await loadAttachments(parentDir, getName, {
          message,
          key,
        });
        return saveMessage(message);
      };

      // eslint-disable-next-line more/no-then
      promiseChain = promiseChain.then(importMessage);

      return false;
    }

    return true;
  });

  await saveAllMessages(messages);

  await promiseChain;
  window.log.info(
    'Finished importing conversation',
    conversationId,
    'Total:',
    total,
    'Skipped:',
    skipped
  );
}

async function importConversations(dir, options) {
  const contents = await getDirContents(dir);
  let promiseChain = Promise.resolve();

  _.forEach(contents, conversationDir => {
    if (!fs.statSync(conversationDir).isDirectory()) {
      return;
    }

    const loadConversation = () => importConversation(conversationDir, options);

    // eslint-disable-next-line more/no-then
    promiseChain = promiseChain.then(loadConversation);
  });

  return promiseChain;
}

function getMessageKey(message) {
  const ourNumber = textsecure.storage.user.getNumber();
  const source = message.source || ourNumber;
  if (source === ourNumber) {
    return `${source} ${message.timestamp}`;
  }

  const sourceDevice = message.sourceDevice || 1;
  return `${source}.${sourceDevice} ${message.timestamp}`;
}
async function loadMessagesLookup() {
  const array = await window.Signal.Data.getAllMessageIds();
  return fromPairs(map(array, item => [getMessageKey(item), true]));
}

function getConversationKey(conversation) {
  return conversation.id;
}
async function loadConversationLookup() {
  const array = await window.Signal.Data.getAllConversationIds();
  return fromPairs(map(array, item => [getConversationKey(item), true]));
}

function getDirectoryForExport() {
  return getDirectory();
}

async function compressArchive(file, targetDir) {
  const items = fs.readdirSync(targetDir);
  return tar.c(
    {
      gzip: true,
      file,
      cwd: targetDir,
    },
    items
  );
}

async function decompressArchive(file, targetDir) {
  return tar.x({
    file,
    cwd: targetDir,
  });
}

function writeFile(targetPath, contents) {
  return pify(fs.writeFile)(targetPath, contents);
}

// prettier-ignore
const UNIQUE_ID = new Uint8Array([
  1, 3, 4, 5, 6, 7, 8, 11,
  23, 34, 1, 34, 3, 5, 45, 45,
  1, 3, 4, 5, 6, 7, 8, 11,
  23, 34, 1, 34, 3, 5, 45, 45,
]);
async function encryptFile(sourcePath, targetPath, options) {
  options = options || {};

  const { key } = options;
  if (!key) {
    throw new Error('Need key to do encryption!');
  }

  const plaintext = await readFileAsArrayBuffer(sourcePath);
  const ciphertext = await crypto.encryptFile(key, UNIQUE_ID, plaintext);
  return writeFile(targetPath, Buffer.from(ciphertext));
}

async function decryptFile(sourcePath, targetPath, options) {
  options = options || {};

  const { key } = options;
  if (!key) {
    throw new Error('Need key to do encryption!');
  }

  const ciphertext = await readFileAsArrayBuffer(sourcePath);
  const plaintext = await crypto.decryptFile(key, UNIQUE_ID, ciphertext);
  return writeFile(targetPath, Buffer.from(plaintext));
}

function createTempDir() {
  return pify(tmp.dir)();
}

function deleteAll(pattern) {
  window.log.info(`Deleting ${pattern}`);
  return pify(rimraf)(pattern);
}

const ARCHIVE_NAME = 'messages.tar.gz';

async function exportToDirectory(directory, options) {
  options = options || {};

  if (!options.key) {
    throw new Error('Encrypted backup requires a key to encrypt with!');
  }

  let stagingDir;
  let encryptionDir;
  try {
    stagingDir = await createTempDir();
    encryptionDir = await createTempDir();

    const attachmentsDir = await createDirectory(directory, 'attachments');

    await exportConversationListToFile(stagingDir);
    await exportConversations(
      Object.assign({}, options, {
        messagesDir: stagingDir,
        attachmentsDir,
      })
    );

    const archivePath = path.join(directory, ARCHIVE_NAME);
    await compressArchive(archivePath, stagingDir);
    await encryptFile(archivePath, path.join(directory, ARCHIVE_NAME), options);

    window.log.info('done backing up!');
    return directory;
  } catch (error) {
    window.log.error(
      'The backup went wrong!',
      error && error.stack ? error.stack : error
    );
    throw error;
  } finally {
    if (stagingDir) {
      await deleteAll(stagingDir);
    }
    if (encryptionDir) {
      await deleteAll(encryptionDir);
    }
  }
}

function getDirectoryForImport() {
  const options = {
    title: i18n('importChooserTitle'),
  };
  return getDirectory(options);
}

async function importFromDirectory(directory, options) {
  options = options || {};

  try {
    const lookups = await Promise.all([
      loadMessagesLookup(),
      loadConversationLookup(),
    ]);
    const [messageLookup, conversationLookup] = lookups;
    options = Object.assign({}, options, {
      messageLookup,
      conversationLookup,
    });

    const archivePath = path.join(directory, ARCHIVE_NAME);
    if (fs.existsSync(archivePath)) {
      // we're in the world of an encrypted, zipped backup
      if (!options.key) {
        throw new Error(
          'Importing an encrypted backup; decryption key is required!'
        );
      }

      let stagingDir;
      let decryptionDir;
      try {
        stagingDir = await createTempDir();
        decryptionDir = await createTempDir();

        const attachmentsDir = path.join(directory, 'attachments');

        const decryptedArchivePath = path.join(decryptionDir, ARCHIVE_NAME);
        await decryptFile(archivePath, decryptedArchivePath, options);
        await decompressArchive(decryptedArchivePath, stagingDir);

        options = Object.assign({}, options, {
          attachmentsDir,
        });
        const result = await importNonMessages(stagingDir, options);
        await importConversations(stagingDir, Object.assign({}, options));

        window.log.info('Done importing from backup!');
        return result;
      } finally {
        if (stagingDir) {
          await deleteAll(stagingDir);
        }
        if (decryptionDir) {
          await deleteAll(decryptionDir);
        }
      }
    }

    const result = await importNonMessages(directory, options);
    await importConversations(directory, options);

    window.log.info('Done importing!');
    return result;
  } catch (error) {
    window.log.error(
      'The import went wrong!',
      error && error.stack ? error.stack : error
    );
    throw error;
  }
}
