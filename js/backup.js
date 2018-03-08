/* global dcodeIO: false */
/* global _: false */
/* global Whisper: false */
/* global textsecure: false */
/* global moment: false */
/* global i18n: false */

/* eslint-env node */

/* eslint-disable no-param-reassign, guard-for-in */

'use strict';

const fs = require('fs');
const path = require('path');

const electronRemote = require('electron').remote;

const {
  dialog,
  BrowserWindow,
} = electronRemote;

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  function stringify(object) {
    // eslint-disable-next-line no-restricted-syntax
    for (const key in object) {
      const val = object[key];
      if (val instanceof ArrayBuffer) {
        object[key] = {
          type: 'ArrayBuffer',
          encoding: 'base64',
          data: dcodeIO.ByteBuffer.wrap(val).toString('base64'),
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
      if (val &&
          val.type === 'ArrayBuffer' &&
          val.encoding === 'base64' &&
          typeof val.data === 'string') {
        object[key] = dcodeIO.ByteBuffer.wrap(val.data, 'base64').toArrayBuffer();
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
        wait = wait.then(() => new Promise(((resolve) => {
          if (writer.write(string)) {
            resolve();
            return;
          }

          //  If write() returns true, we don't need to wait for the drain event
          //   https://nodejs.org/dist/latest-v7.x/docs/api/stream.html#stream_class_stream_writable
          writer.once('drain', resolve);

          // We don't register for the 'error' event here, only in close(). Otherwise,
          //   we'll get "Possible EventEmitter memory leak detected" warnings.
        })));
        return wait;
      },
      async close() {
        await wait;
        return new Promise(((resolve, reject) => {
          writer.once('finish', resolve);
          writer.once('error', reject);
          writer.end();
        }));
      },
    };
  }

  async function exportNonMessages(db, parent, options) {
    const writer = await createFileAndWriter(parent, 'db.json');
    return exportToJsonFile(db, writer, options);
  }

  function exportToJsonFile(db, fileWriter, options) {
    options = options || {};
    _.defaults(options, { excludeClientConfig: false });

    return new Promise(((resolve, reject) => {
      let storeNames = db.objectStoreNames;
      storeNames = _.without(storeNames, 'messages');

      if (options.excludeClientConfig) {
        console.log('exportToJsonFile: excluding client config from export');
        storeNames = _.without(
          storeNames,
          'items',
          'signedPreKeys',
          'preKeys',
          'identityKeys',
          'sessions',
          'unprocessed' // since we won't be able to decrypt them anyway
        );
      }

      const exportedStoreNames = [];
      if (storeNames.length === 0) {
        throw new Error('No stores to export');
      }
      console.log('Exporting from these stores:', storeNames.join(', '));

      const stream = createOutputStream(fileWriter);

      stream.write('{');

      _.each(storeNames, (storeName) => {
        const transaction = db.transaction(storeNames, 'readwrite');
        transaction.onerror = () => {
          Whisper.Database.handleDOMException(
            `exportToJsonFile transaction error (store: ${storeName})`,
            transaction.error,
            reject
          );
        };
        transaction.oncomplete = () => {
          console.log('transaction complete');
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
        request.onsuccess = async (event) => {
          if (count === 0) {
            console.log('cursor opened');
            stream.write(`"${storeName}": [`);
          }

          const cursor = event.target.result;
          if (cursor) {
            if (count > 0) {
              stream.write(',');
            }
            const jsonString = JSON.stringify(stringify(cursor.value));
            stream.write(jsonString);
            cursor.continue();
            count += 1;
          } else {
            // no more
            stream.write(']');
            console.log('Exported', count, 'items from store', storeName);

            exportedStoreNames.push(storeName);
            if (exportedStoreNames.length < storeNames.length) {
              stream.write(',');
            } else {
              console.log('Exported all stores');
              stream.write('}');

              await stream.close();
              console.log('Finished writing all stores to disk');
              resolve();
            }
          }
        };
      });
    }));
  }

  async function importNonMessages(db, parent, options) {
    const file = 'db.json';
    const string = await readFileAsText(parent, file);
    return importFromJsonString(db, string, path.join(parent, file), options);
  }

  function eliminateClientConfigInBackup(data, targetPath) {
    const cleaned = _.pick(data, 'conversations', 'groups');
    console.log('Writing configuration-free backup file back to disk');
    try {
      fs.writeFileSync(targetPath, JSON.stringify(cleaned));
    } catch (error) {
      console.log('Error writing cleaned-up backup to disk: ', error.stack);
    }
  }

  function importFromJsonString(db, jsonString, targetPath, options) {
    options = options || {};
    _.defaults(options, {
      forceLightImport: false,
      conversationLookup: {},
      groupLookup: {},
    });

    const {
      conversationLookup,
      groupLookup,
    } = options;
    const result = {
      fullImport: true,
    };

    return new Promise(((resolve, reject) => {
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

        console.log('This is a light import; contacts, groups and messages only');
      }

      // We mutate the on-disk backup to prevent the user from importing client
      //   configuration more than once - that causes lots of encryption errors.
      //   This of course preserves the true data: conversations and groups.
      eliminateClientConfigInBackup(importObject, targetPath);

      const storeNames = _.keys(importObject);
      console.log('Importing to these stores:', storeNames.join(', '));

      let finished = false;
      const finish = (via) => {
        console.log('non-messages import done via', via);
        if (finished) {
          resolve(result);
        }
        finished = true;
      };

      const transaction = db.transaction(storeNames, 'readwrite');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          'importFromJsonString transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = finish.bind(null, 'transaction complete');

      _.each(storeNames, (storeName) => {
        console.log('Importing items for store', storeName);

        if (!importObject[storeName].length) {
          delete importObject[storeName];
          return;
        }

        let count = 0;
        let skipCount = 0;

        const finishStore = () => {
          // added all objects for this store
          delete importObject[storeName];
          console.log(
            'Done importing to store',
            storeName,
            'Total count:',
            count,
            'Skipped:',
            skipCount
          );
          if (_.keys(importObject).length === 0) {
            // added all object stores
            console.log('DB import complete');
            finish('puts scheduled');
          }
        };

        _.each(importObject[storeName], (toAdd) => {
          toAdd = unstringify(toAdd);

          const haveConversationAlready =
                storeName === 'conversations' &&
                conversationLookup[getConversationKey(toAdd)];
          const haveGroupAlready =
                storeName === 'groups' && groupLookup[getGroupKey(toAdd)];

          if (haveConversationAlready || haveGroupAlready) {
            skipCount += 1;
            count += 1;
            return;
          }

          const request = transaction.objectStore(storeName).put(toAdd, toAdd.id);
          request.onsuccess = () => {
            count += 1;
            if (count === importObject[storeName].length) {
              finishStore();
            }
          };
          request.onerror = () => {
            Whisper.Database.handleDOMException(
              `importFromJsonString request error (store: ${storeName})`,
              request.error,
              reject
            );
          };
        });

        // We have to check here, because we may have skipped every item, resulting
        //   in no onsuccess callback at all.
        if (count === importObject[storeName].length) {
          finishStore();
        }
      });
    }));
  }

  function createDirectory(parent, name) {
    return new Promise(((resolve, reject) => {
      const sanitized = sanitizeFileName(name);
      const targetDir = path.join(parent, sanitized);
      fs.mkdir(targetDir, (error) => {
        if (error) {
          return reject(error);
        }

        return resolve(targetDir);
      });
    }));
  }

  function createFileAndWriter(parent, name) {
    return new Promise(((resolve) => {
      const sanitized = sanitizeFileName(name);
      const targetPath = path.join(parent, sanitized);
      const options = {
        flags: 'wx',
      };
      return resolve(fs.createWriteStream(targetPath, options));
    }));
  }

  function readFileAsText(parent, name) {
    return new Promise(((resolve, reject) => {
      const targetPath = path.join(parent, name);
      fs.readFile(targetPath, 'utf8', (error, string) => {
        if (error) {
          return reject(error);
        }

        return resolve(string);
      });
    }));
  }

  function readFileAsArrayBuffer(parent, name) {
    return new Promise(((resolve, reject) => {
      const targetPath = path.join(parent, name);
      // omitting the encoding to get a buffer back
      fs.readFile(targetPath, (error, buffer) => {
        if (error) {
          return reject(error);
        }

        // Buffer instances are also Uint8Array instances
        //   https://nodejs.org/docs/latest/api/buffer.html#buffer_buffers_and_typedarray
        return resolve(buffer.buffer);
      });
    }));
  }

  function trimFileName(filename) {
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


  function getAttachmentFileName(attachment) {
    if (attachment.fileName) {
      return trimFileName(attachment.fileName);
    }

    let name = attachment.id;

    if (attachment.contentType) {
      const components = attachment.contentType.split('/');
      name += `.${components.length > 1 ? components[1] : attachment.contentType}`;
    }

    return name;
  }

  async function readAttachment(parent, message, attachment) {
    const name = getAttachmentFileName(attachment);
    const sanitized = sanitizeFileName(name);
    const attachmentDir = path.join(parent, message.received_at.toString());

    attachment.data = await readFileAsArrayBuffer(attachmentDir, sanitized);
  }

  async function writeAttachment(dir, attachment) {
    const filename = getAttachmentFileName(attachment);
    const writer = await createFileAndWriter(dir, filename);
    const stream = createOutputStream(writer);
    stream.write(Buffer.from(attachment.data));
    return stream.close();
  }

  async function writeAttachments(parentDir, name, messageId, attachments) {
    const dir = await createDirectory(parentDir, messageId);
    const promises = _.map(attachments, attachment => writeAttachment(dir, attachment));
    try {
      await Promise.all(promises);
    } catch (error) {
      console.log(
        'writeAttachments: error exporting conversation',
        name,
        ':',
        error && error.stack ? error.stack : error
      );
      throw error;
    }
  }

  function sanitizeFileName(filename) {
    return filename.toString().replace(/[^a-z0-9.,+()'#\- ]/gi, '_');
  }

  async function exportConversation(db, name, conversation, dir) {
    console.log('exporting conversation', name);
    const writer = await createFileAndWriter(dir, 'messages.json');
    return new Promise(((resolve, reject) => {
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
      const range = IDBKeyRange.bound(
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
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const message = cursor.value;
          const messageId = message.received_at;
          const { attachments } = message;

          // skip message if it is disappearing, no matter the amount of time left
          if (message.expireTimer) {
            cursor.continue();
            return;
          }

          if (count !== 0) {
            stream.write(',');
          }

          message.attachments = _.map(
            attachments,
            attachment => _.omit(attachment, ['data'])
          );

          const jsonString = JSON.stringify(stringify(message));
          stream.write(jsonString);

          if (attachments && attachments.length) {
            const process = () => writeAttachments(dir, name, messageId, attachments);
            // eslint-disable-next-line more/no-then
            promiseChain = promiseChain.then(process);
          }

          count += 1;
          cursor.continue();
        } else {
          try {
            await Promise.all([
              stream.write(']}'),
              promiseChain,
              stream.close(),
            ]);
          } catch (error) {
            console.log(
              'exportConversation: error exporting conversation',
              name,
              ':',
              error && error.stack ? error.stack : error
            );
            reject(error);
            return;
          }

          console.log('done exporting conversation', name);
          resolve();
        }
      };
    }));
  }

  // Goals for directory names:
  //   1. Human-readable, for easy use and verification by user (names not just ids)
  //   2. Sorted just like the list of conversations in the left-pan (active_at)
  //   3. Disambiguated from other directories (active_at, truncated name, id)
  function getConversationDirName(conversation) {
    const name = conversation.active_at || 'never';
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
  function getConversationLoggingName(conversation) {
    let name = conversation.active_at || 'never';
    if (conversation.type === 'private') {
      name += ` (${conversation.id})`;
    } else {
      name += ` ([REDACTED_GROUP]${conversation.id.slice(-3)})`;
    }
    return name;
  }

  function exportConversations(db, parentDir) {
    return new Promise(((resolve, reject) => {
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
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor && cursor.value) {
          const conversation = cursor.value;
          const dirName = getConversationDirName(conversation);
          const name = getConversationLoggingName(conversation);

          const process = async () => {
            const dir = await createDirectory(parentDir, dirName);
            return exportConversation(db, name, conversation, dir);
          };

          console.log('scheduling export for conversation', name);
          // eslint-disable-next-line more/no-then
          promiseChain = promiseChain.then(process);
          cursor.continue();
        } else {
          console.log('Done scheduling conversation exports');
          try {
            await promiseChain;
          } catch (error) {
            reject(error);
            return;
          }
          resolve();
        }
      };
    }));
  }

  function getDirectory(options) {
    return new Promise(((resolve, reject) => {
      const browserWindow = BrowserWindow.getFocusedWindow();
      const dialogOptions = {
        title: options.title,
        properties: ['openDirectory'],
        buttonLabel: options.buttonLabel,
      };

      dialog.showOpenDialog(browserWindow, dialogOptions, (directory) => {
        if (!directory || !directory[0]) {
          const error = new Error('Error choosing directory');
          error.name = 'ChooseError';
          return reject(error);
        }

        return resolve(directory[0]);
      });
    }));
  }

  function getDirContents(dir) {
    return new Promise(((resolve, reject) => {
      fs.readdir(dir, (err, files) => {
        if (err) {
          reject(err);
          return;
        }

        files = _.map(files, file => path.join(dir, file));

        resolve(files);
      });
    }));
  }

  function loadAttachments(dir, message) {
    const promises = _.map(message.attachments, attachment => readAttachment(
      dir,
      message,
      attachment
    ));
    return Promise.all(promises);
  }

  function saveMessage(db, message) {
    return saveAllMessages(db, [message]);
  }

  function saveAllMessages(db, messages) {
    if (!messages.length) {
      return Promise.resolve();
    }

    return new Promise(((resolve, reject) => {
      let finished = false;
      const finish = (via) => {
        console.log('messages done saving via', via);
        if (finished) {
          resolve();
        }
        finished = true;
      };

      const transaction = db.transaction('messages', 'readwrite');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          'saveAllMessages transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = finish.bind(null, 'transaction complete');

      const store = transaction.objectStore('messages');
      const { conversationId } = messages[0];
      let count = 0;

      _.forEach(messages, (message) => {
        const request = store.put(message, message.id);
        request.onsuccess = () => {
          count += 1;
          if (count === messages.length) {
            console.log(
              'Saved',
              messages.length,
              'messages for conversation',
              // Don't know if group or private conversation, so we blindly redact
              `[REDACTED]${conversationId.slice(-3)}`
            );
            finish('puts scheduled');
          }
        };
        request.onerror = () => {
          Whisper.Database.handleDOMException(
            'saveAllMessages request error',
            request.error,
            reject
          );
        };
      });
    }));
  }

  // To reduce the memory impact of attachments, we make individual saves to the
  //   database for every message with an attachment. We load the attachment for a
  //   message, save it, and only then do we move on to the next message. Thus, every
  //   message with attachments needs to be removed from our overall message save with the
  //   filter() call.
  async function importConversation(db, dir, options) {
    options = options || {};
    _.defaults(options, { messageLookup: {} });

    const { messageLookup } = options;
    let conversationId = 'unknown';
    let total = 0;
    let skipped = 0;
    let contents;

    try {
      contents = await readFileAsText(dir, 'messages.json');
    } catch (error) {
      console.log(`Warning: could not access messages.json in directory: ${dir}`);
    }

    let promiseChain = Promise.resolve();

    const json = JSON.parse(contents);
    if (json.messages && json.messages.length) {
      conversationId = `[REDACTED]${(json.messages[0].conversationId || '').slice(-3)}`;
    }
    total = json.messages.length;

    const messages = _.filter(json.messages, (message) => {
      message = unstringify(message);

      if (messageLookup[getMessageKey(message)]) {
        skipped += 1;
        return false;
      }

      if (message.attachments && message.attachments.length) {
        const process = async () => {
          await loadAttachments(dir, message);
          return saveMessage(db, message);
        };

        // eslint-disable-next-line more/no-then
        promiseChain = promiseChain.then(process);

        return false;
      }

      return true;
    });

    if (messages.length > 0) {
      await saveAllMessages(db, messages);
    }

    await promiseChain;
    console.log(
      'Finished importing conversation',
      conversationId,
      'Total:',
      total,
      'Skipped:',
      skipped
    );
  }

  async function importConversations(db, dir, options) {
    const contents = await getDirContents(dir);

    let promiseChain = Promise.resolve();

    _.forEach(contents, (conversationDir) => {
      if (!fs.statSync(conversationDir).isDirectory()) {
        return;
      }

      const process = () => importConversation(db, conversationDir, options);

      // eslint-disable-next-line more/no-then
      promiseChain = promiseChain.then(process);
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
  function loadMessagesLookup(db) {
    return assembleLookup(db, 'messages', getMessageKey);
  }

  function getConversationKey(conversation) {
    return conversation.id;
  }
  function loadConversationLookup(db) {
    return assembleLookup(db, 'conversations', getConversationKey);
  }

  function getGroupKey(group) {
    return group.id;
  }
  function loadGroupsLookup(db) {
    return assembleLookup(db, 'groups', getGroupKey);
  }

  function assembleLookup(db, storeName, keyFunction) {
    const lookup = Object.create(null);

    return new Promise(((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          `assembleLookup(${storeName}) transaction error`,
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = () => {
        // not really very useful - fires at unexpected times
      };

      const store = transaction.objectStore(storeName);
      const request = store.openCursor();
      request.onerror = () => {
        Whisper.Database.handleDOMException(
          `assembleLookup(${storeName}) request error`,
          request.error,
          reject
        );
      };
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && cursor.value) {
          lookup[keyFunction(cursor.value)] = true;
          cursor.continue();
        } else {
          console.log(`Done creating ${storeName} lookup`);
          resolve(lookup);
        }
      };
    }));
  }


  function getTimestamp() {
    return moment().format('YYYY MMM Do [at] h.mm.ss a');
  }

  // directories returned and taken by backup/import are all string paths
  Whisper.Backup = {
    getDirectoryForExport() {
      const options = {
        title: i18n('exportChooserTitle'),
        buttonLabel: i18n('exportButton'),
      };
      return getDirectory(options);
    },
    async exportToDirectory(directory, options) {
      const name = `Signal Export ${getTimestamp()}`;
      try {
        const db = await Whisper.Database.open();
        const dir = await createDirectory(directory, name);
        await exportNonMessages(db, dir, options);
        await exportConversations(db, dir);

        console.log('done backing up!');
        return dir;
      } catch (error) {
        console.log(
          'the backup went wrong:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }
    },
    getDirectoryForImport() {
      const options = {
        title: i18n('importChooserTitle'),
        buttonLabel: i18n('importButton'),
      };
      return getDirectory(options);
    },
    async importFromDirectory(directory, options) {
      options = options || {};

      try {
        const db = await Whisper.Database.open();
        const lookups = await Promise.all([
          loadMessagesLookup(db),
          loadConversationLookup(db),
          loadGroupsLookup(db),
        ]);
        const [messageLookup, conversationLookup, groupLookup] = lookups;
        options = Object.assign({}, options, {
          messageLookup,
          conversationLookup,
          groupLookup,
        });

        const result = await importNonMessages(db, directory, options);
        await importConversations(db, directory, options);
        console.log('done restoring from backup!');
        return result;
      } catch (error) {
        console.log(
          'the import went wrong:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }
    },
    // for testing
    sanitizeFileName,
    trimFileName,
    getAttachmentFileName,
    getConversationDirName,
    getConversationLoggingName,
  };
}());
