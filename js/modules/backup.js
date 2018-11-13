/* global Signal: false */
/* global Whisper: false */
/* global _: false */
/* global textsecure: false */
/* global i18n: false */

/* eslint-env browser */
/* eslint-env node */

/* eslint-disable no-param-reassign, guard-for-in, no-unreachable */

const fs = require('fs');
const path = require('path');

const { map, fromPairs } = require('lodash');
const tmp = require('tmp');
const pify = require('pify');
const archiver = require('archiver');
const rimraf = require('rimraf');
const electronRemote = require('electron').remote;

const Attachment = require('./types/attachment');
const crypto = require('./crypto');

const decompress = () => null;
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

async function exportContactAndGroupsToFile(db, parent) {
  const writer = await createFileAndWriter(parent, 'db.json');
  return exportContactsAndGroups(db, writer);
}

function exportContactsAndGroups(db, fileWriter) {
  return new Promise((resolve, reject) => {
    let storeNames = db.objectStoreNames;
    storeNames = _.without(
      storeNames,
      'messages',
      'items',
      'signedPreKeys',
      'preKeys',
      'identityKeys',
      'sessions',
      'unprocessed'
    );

    const exportedStoreNames = [];
    if (storeNames.length === 0) {
      throw new Error('No stores to export');
    }
    window.log.info('Exporting from these stores:', storeNames.join(', '));

    const stream = createOutputStream(fileWriter);

    stream.write('{');

    _.each(storeNames, storeName => {
      // Both the readwrite permission and the multi-store transaction are required to
      //   keep this function working. They serve to serialize all of these transactions,
      //   one per store to be exported.
      const transaction = db.transaction(storeNames, 'readwrite');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          `exportToJsonFile transaction error (store: ${storeName})`,
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = () => {
        window.log.info('transaction complete');
      };

      const store = transaction.objectStore(storeName);
      const request = store.openCursor();
      let count = 0;
      request.onerror = () => {
        Whisper.Database.handleDOMException(
          `exportToJsonFile request error (store: ${storeNames})`,
          request.error,
          reject
        );
      };
      request.onsuccess = async event => {
        if (count === 0) {
          window.log.info('cursor opened');
          stream.write(`"${storeName}": [`);
        }

        const cursor = event.target.result;
        if (cursor) {
          if (count > 0) {
            stream.write(',');
          }

          // Preventing base64'd images from reaching the disk, making db.json too big
          const item = _.omit(cursor.value, ['avatar', 'profileAvatar']);

          const jsonString = JSON.stringify(stringify(item));
          stream.write(jsonString);
          cursor.continue();
          count += 1;
        } else {
          // no more
          stream.write(']');
          window.log.info('Exported', count, 'items from store', storeName);

          exportedStoreNames.push(storeName);
          if (exportedStoreNames.length < storeNames.length) {
            stream.write(',');
          } else {
            window.log.info('Exported all stores');
            stream.write('}');

            await stream.close();
            window.log.info('Finished writing all stores to disk');
            resolve();
          }
        }
      };
    });
  });
}

async function importNonMessages(parent, options) {
  const file = 'db.json';
  const string = await readFileAsText(parent, file);
  return importFromJsonString(string, path.join(parent, file), options);
}

function eliminateClientConfigInBackup(data, targetPath) {
  const cleaned = _.pick(data, 'conversations', 'groups');
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
    groupLookup: {},
  });

  const { groupLookup } = options;
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
  //   This of course preserves the true data: conversations and groups.
  eliminateClientConfigInBackup(importObject, targetPath);

  const storeNames = _.keys(importObject);
  window.log.info('Importing to these stores:', storeNames.join(', '));

  // Special-case conversations key here, going to SQLCipher
  const { conversations } = importObject;
  const remainingStoreNames = _.without(
    storeNames,
    'conversations',
    'unprocessed'
  );
  await importConversationsFromJSON(conversations, options);

  const SAVE_FUNCTIONS = {
    groups: window.Signal.Data.createOrUpdateGroup,
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

      let skipCount = 0;

      for (let i = 0, max = toImport.length; i < max; i += 1) {
        const toAdd = unstringify(toImport[i]);

        const haveGroupAlready =
          storeName === 'groups' && groupLookup[getGroupKey(toAdd)];

        if (haveGroupAlready) {
          skipCount += 1;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await save(toAdd);
        }
      }

      window.log.info(
        'Done importing to store',
        storeName,
        'Total count:',
        toImport.length,
        'Skipped:',
        skipCount
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

function readFileAsArrayBuffer(targetPath) {
  return new Promise((resolve, reject) => {
    // omitting the encoding to get a buffer back
    fs.readFile(targetPath, (error, buffer) => {
      if (error) {
        return reject(error);
      }

      // Buffer instances are also Uint8Array instances
      //   https://nodejs.org/docs/latest/api/buffer.html#buffer_buffers_and_typedarray
      return resolve(buffer.buffer);
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

async function readAttachment(dir, attachment, name, options) {
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
    attachment.data = await crypto.decryptSymmetric(key, data);
  } else {
    attachment.data = data;
  }
}

async function writeThumbnail(attachment, options) {
  const { dir, message, index, key, newKey } = options;
  const filename = `${_getAnonymousAttachmentFileName(
    message,
    index
  )}-thumbnail`;
  const target = path.join(dir, filename);
  const { thumbnail } = attachment;

  if (!thumbnail || !thumbnail.data) {
    return;
  }

  await writeEncryptedAttachment(target, thumbnail.data, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writeThumbnails(rawQuotedAttachments, options) {
  const { name } = options;

  const { loadAttachmentData } = Signal.Migrations;
  const promises = rawQuotedAttachments.map(async attachment => {
    if (!attachment || !attachment.thumbnail || !attachment.thumbnail.path) {
      return attachment;
    }

    return Object.assign({}, attachment, {
      thumbnail: await loadAttachmentData(attachment.thumbnail),
    });
  });

  const attachments = await Promise.all(promises);
  try {
    await Promise.all(
      _.map(attachments, (attachment, index) =>
        writeThumbnail(
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
  const { dir, message, index, key, newKey } = options;
  const filename = _getAnonymousAttachmentFileName(message, index);
  const target = path.join(dir, filename);
  if (!Attachment.hasData(attachment)) {
    throw new TypeError("'attachment.data' is required");
  }

  await writeEncryptedAttachment(target, attachment.data, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writeAttachments(rawAttachments, options) {
  const { name } = options;

  const { loadAttachmentData } = Signal.Migrations;
  const attachments = await Promise.all(rawAttachments.map(loadAttachmentData));
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

async function writeAvatar(avatar, options) {
  const { dir, message, index, key, newKey } = options;
  const name = _getAnonymousAttachmentFileName(message, index);
  const filename = `${name}-contact-avatar`;

  const target = path.join(dir, filename);
  if (!avatar || !avatar.path) {
    return;
  }

  await writeEncryptedAttachment(target, avatar.data, {
    key,
    newKey,
    filename,
    dir,
  });
}

async function writeContactAvatars(contact, options) {
  const { name } = options;

  const { loadAttachmentData } = Signal.Migrations;
  const promises = contact.map(async item => {
    if (
      !item ||
      !item.avatar ||
      !item.avatar.avatar ||
      !item.avatar.avatar.path
    ) {
      return null;
    }

    return loadAttachmentData(item.avatar.avatar);
  });

  try {
    await Promise.all(
      _.map(await Promise.all(promises), (item, index) =>
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

async function writeEncryptedAttachment(target, data, options = {}) {
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

  const ciphertext = await crypto.encryptSymmetric(key, data);

  const writer = await createFileAndWriter(dir, filename);
  const stream = createOutputStream(writer);
  stream.write(Buffer.from(ciphertext));
  await stream.close();
}

function _sanitizeFileName(filename) {
  return filename.toString().replace(/[^a-z0-9.,+()'#\- ]/gi, '_');
}

async function exportConversation(db, conversation, options) {
  options = options || {};
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

  return new Promise(async (resolve, reject) => {
    // TODO: need to iterate through message ids, export using window.Signal.Data
    const transaction = db.transaction('messages', 'readwrite');
    transaction.onerror = () => {
      Whisper.Database.handleDOMException(
        `exportConversation transaction error (conversation: ${name})`,
        transaction.error,
        reject
      );
    };
    transaction.oncomplete = () => {
      // this doesn't really mean anything - we may have attachment processing to do
    };

    const store = transaction.objectStore('messages');
    const index = store.index('conversation');
    const range = window.IDBKeyRange.bound(
      [conversation.id, 0],
      [conversation.id, Number.MAX_VALUE]
    );

    let promiseChain = Promise.resolve();
    let count = 0;
    const request = index.openCursor(range);

    const stream = createOutputStream(writer);
    stream.write('{"messages":[');

    request.onerror = () => {
      Whisper.Database.handleDOMException(
        `exportConversation request error (conversation: ${name})`,
        request.error,
        reject
      );
    };
    request.onsuccess = async event => {
      const cursor = event.target.result;
      if (cursor) {
        const message = cursor.value;
        const { attachments } = message;

        // skip message if it is disappearing, no matter the amount of time left
        if (message.expireTimer) {
          cursor.continue();
          return;
        }

        if (count !== 0) {
          stream.write(',');
        }

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
          const exportAttachments = () =>
            writeAttachments(attachments, {
              dir: attachmentsDir,
              name,
              message,
              key,
              newKey,
            });

          // eslint-disable-next-line more/no-then
          promiseChain = promiseChain.then(exportAttachments);
        }

        const quoteThumbnails = message.quote && message.quote.attachments;
        if (quoteThumbnails && quoteThumbnails.length > 0) {
          const exportQuoteThumbnails = () =>
            writeThumbnails(quoteThumbnails, {
              dir: attachmentsDir,
              name,
              message,
              key,
              newKey,
            });

          // eslint-disable-next-line more/no-then
          promiseChain = promiseChain.then(exportQuoteThumbnails);
        }

        const { contact } = message;
        if (contact && contact.length > 0) {
          const exportContactAvatars = () =>
            writeContactAvatars(contact, {
              dir: attachmentsDir,
              name,
              message,
              key,
              newKey,
            });

          // eslint-disable-next-line more/no-then
          promiseChain = promiseChain.then(exportContactAvatars);
        }

        count += 1;
        cursor.continue();
      } else {
        try {
          await Promise.all([stream.write(']}'), promiseChain, stream.close()]);
        } catch (error) {
          window.log.error(
            'exportConversation: error exporting conversation',
            name,
            ':',
            error && error.stack ? error.stack : error
          );
          reject(error);
          return;
        }

        window.log.info('done exporting conversation', name);
        resolve();
      }
    };
  });
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

function exportConversations(db, options) {
  options = options || {};
  const { messagesDir, attachmentsDir, key, newKey } = options;

  if (!messagesDir) {
    return Promise.reject(new Error('Need a messages directory!'));
  }
  if (!attachmentsDir) {
    return Promise.reject(new Error('Need an attachments directory!'));
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readwrite');
    transaction.onerror = () => {
      Whisper.Database.handleDOMException(
        'exportConversations transaction error',
        transaction.error,
        reject
      );
    };
    transaction.oncomplete = () => {
      // not really very useful - fires at unexpected times
    };

    let promiseChain = Promise.resolve();
    const store = transaction.objectStore('conversations');
    const request = store.openCursor();
    request.onerror = () => {
      Whisper.Database.handleDOMException(
        'exportConversations request error',
        request.error,
        reject
      );
    };
    request.onsuccess = async event => {
      const cursor = event.target.result;
      if (cursor && cursor.value) {
        const conversation = cursor.value;
        const dirName = _getConversationDirName(conversation);
        const name = _getConversationLoggingName(conversation);

        const process = async () => {
          const dir = await createDirectory(messagesDir, dirName);
          return exportConversation(db, conversation, {
            name,
            dir,
            attachmentsDir,
            key,
            newKey,
          });
        };

        window.log.info('scheduling export for conversation', name);
        // eslint-disable-next-line more/no-then
        promiseChain = promiseChain.then(process);
        cursor.continue();
      } else {
        window.log.info('Done scheduling conversation exports');
        try {
          await promiseChain;
        } catch (error) {
          reject(error);
          return;
        }
        resolve();
      }
    };
  });
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
    _.map(message.attachments, (attachment, index) => {
      const name = getName(message, index, attachment);
      return readAttachment(dir, attachment, name, options);
    })
  );

  const quoteAttachments = message.quote && message.quote.attachments;
  await Promise.all(
    _.map(quoteAttachments, (attachment, index) => {
      const thumbnail = attachment && attachment.thumbnail;
      if (!thumbnail) {
        return null;
      }

      const name = `${getName(message, index)}-thumbnail`;
      return readAttachment(dir, thumbnail, name, options);
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
      return readAttachment(dir, avatar, name, options);
    })
  );

  // TODO: Handle video screenshots, and image/video thumbnails
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

    if (hasAttachments || hasQuotedAttachments || hasContacts) {
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

function getGroupKey(group) {
  return group.id;
}
async function loadGroupsLookup() {
  const array = await window.Signal.Data.getAllGroupIds();
  return fromPairs(map(array, item => [getGroupKey(item), true]));
}

function getDirectoryForExport() {
  return getDirectory();
}

function createZip(zipDir, targetDir) {
  return new Promise((resolve, reject) => {
    const target = path.join(zipDir, 'messages.zip');
    const output = fs.createWriteStream(target);
    const archive = archiver('zip', {
      cwd: targetDir,
    });

    output.on('close', () => {
      resolve(target);
    });

    archive.on('warning', error => {
      window.log.warn(`Archive generation warning: ${error.stack}`);
    });
    archive.on('error', reject);

    archive.pipe(output);

    // The empty string ensures that the base location of the files added to the zip
    //   is nothing. If you provide null, you get the absolute path you pulled the files
    //   from in the first place.
    archive.directory(targetDir, '');

    archive.finalize();
  });
}

function writeFile(targetPath, contents) {
  return pify(fs.writeFile)(targetPath, contents);
}

async function encryptFile(sourcePath, targetPath, options) {
  options = options || {};

  const { key } = options;
  if (!key) {
    throw new Error('Need key to do encryption!');
  }

  const plaintext = await readFileAsArrayBuffer(sourcePath);
  const ciphertext = await crypto.encryptSymmetric(key, plaintext);
  return writeFile(targetPath, ciphertext);
}

async function decryptFile(sourcePath, targetPath, options) {
  options = options || {};

  const { key } = options;
  if (!key) {
    throw new Error('Need key to do encryption!');
  }

  const ciphertext = await readFileAsArrayBuffer(sourcePath);
  const plaintext = await crypto.decryptSymmetric(key, ciphertext);
  return writeFile(targetPath, Buffer.from(plaintext));
}

function createTempDir() {
  return pify(tmp.dir)();
}

function deleteAll(pattern) {
  window.log.info(`Deleting ${pattern}`);
  return pify(rimraf)(pattern);
}

async function exportToDirectory(directory, options) {
  throw new Error('Encrypted export/import is disabled');

  options = options || {};

  if (!options.key) {
    throw new Error('Encrypted backup requires a key to encrypt with!');
  }

  let stagingDir;
  let encryptionDir;
  try {
    stagingDir = await createTempDir();
    encryptionDir = await createTempDir();

    const db = await Whisper.Database.open();
    const attachmentsDir = await createDirectory(directory, 'attachments');

    await exportContactAndGroupsToFile(db, stagingDir);
    await exportConversations(
      db,
      Object.assign({}, options, {
        messagesDir: stagingDir,
        attachmentsDir,
      })
    );

    const zip = await createZip(encryptionDir, stagingDir);
    await encryptFile(zip, path.join(directory, 'messages.zip'), options);

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
      loadGroupsLookup(),
    ]);
    const [messageLookup, conversationLookup, groupLookup] = lookups;
    options = Object.assign({}, options, {
      messageLookup,
      conversationLookup,
      groupLookup,
    });

    const zipPath = path.join(directory, 'messages.zip');
    if (fs.existsSync(zipPath)) {
      throw new Error('Encrypted export/import is disabled');

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

        const decryptedZip = path.join(decryptionDir, 'messages.zip');
        await decryptFile(zipPath, decryptedZip, options);
        await decompress(decryptedZip, stagingDir);

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
