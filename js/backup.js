;(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  var electronRemote = require('electron').remote;
  var dialog = electronRemote.dialog;
  var BrowserWindow = electronRemote.BrowserWindow;

  var fs = require('fs');
  var path = require('path');

  function stringify(object) {
    for (var key in object) {
      var val = object[key];
      if (val instanceof ArrayBuffer) {
        object[key] = {
          type: 'ArrayBuffer',
          encoding: 'base64',
          data: dcodeIO.ByteBuffer.wrap(val).toString('base64')
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
    for (var key in object) {
      var val = object[key];
      if (val &&
          val.type === 'ArrayBuffer' &&
          val.encoding === 'base64' &&
          typeof val.data === 'string' ) {
        object[key] = dcodeIO.ByteBuffer.wrap(val.data, 'base64').toArrayBuffer();
      } else if (val instanceof Object) {
        object[key] = unstringify(object[key]);
      }
    }
    return object;
  }

  function createOutputStream(writer) {
    var wait = Promise.resolve();
    return {
      write: function(string) {
        wait = wait.then(function() {
          return new Promise(function(resolve) {
            if (writer.write(string)) {
              return resolve();
            }

            //  If write() returns true, we don't need to wait for the drain event
            //   https://nodejs.org/dist/latest-v7.x/docs/api/stream.html#stream_class_stream_writable
            writer.once('drain', resolve);

            // We don't register for the 'error' event here, only in close(). Otherwise,
            //   we'll get "Possible EventEmitter memory leak detected" warnings.
          });
        });
        return wait;
      },
      close: function() {
        return wait.then(function() {
          return new Promise(function(resolve, reject) {
            writer.once('finish', resolve);
            writer.once('error', reject);
            writer.end();
          });
        });
      }
    };
  }

  function exportNonMessages(idb_db, parent, options) {
    return createFileAndWriter(parent, 'db.json').then(function(writer) {
      return exportToJsonFile(idb_db, writer, options);
    });
  }

  /**
  * Export all data from an IndexedDB database
  * @param {IDBDatabase} idb_db
  */
  function exportToJsonFile(idb_db, fileWriter, options) {
    options = options || {};
    _.defaults(options, {excludeClientConfig: false});

    return new Promise(function(resolve, reject) {
      var storeNames = idb_db.objectStoreNames;
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

      var exportedStoreNames = [];
      if (storeNames.length === 0) {
        throw new Error('No stores to export');
      }
      console.log('Exporting from these stores:', storeNames.join(', '));

      var stream = createOutputStream(fileWriter);

      stream.write('{');

      _.each(storeNames, function(storeName) {
        var transaction = idb_db.transaction(storeNames, 'readwrite');
        transaction.onerror = function(e) {
          handleDOMException(
            'exportToJsonFile transaction error (store: ' + storeName + ')',
            transaction.error,
            reject
          );
        };
        transaction.oncomplete = function() {
          console.log('transaction complete');
        };

        var store = transaction.objectStore(storeName);
        var request = store.openCursor();
        var count = 0;
        request.onerror = function(e) {
          handleDOMException(
            'exportToJsonFile request error (store: ' + storeNames + ')',
            request.error,
            reject
          );
        };
        request.onsuccess = function(event) {
          if (count === 0) {
            console.log('cursor opened');
            stream.write('"' + storeName + '": [');
          }

          var cursor = event.target.result;
          if (cursor) {
            if (count > 0) {
              stream.write(',');
            }
            var jsonString = JSON.stringify(stringify(cursor.value));
            stream.write(jsonString);
            cursor.continue();
            count++;
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

              stream.close().then(function() {
                console.log('Finished writing all stores to disk');
                resolve();
              });
            }
          }
        };
      });
    });
  }

  function importNonMessages(idb_db, parent, options) {
    var file = 'db.json';
    return readFileAsText(parent, file).then(function(string) {
      return importFromJsonString(idb_db, string, path.join(parent, file), options);
    });
  }

  function handleDOMException(prefix, error, reject) {
    console.log(
      prefix + ':',
      error && error.name,
      error && error.message,
      error && error.code
    );
    reject(error || new Error(prefix));
  }

  function eliminateClientConfigInBackup(data, path) {
    var cleaned = _.pick(data, 'conversations', 'groups');
    console.log('Writing configuration-free backup file back to disk');
    try {
      fs.writeFileSync(path, JSON.stringify(cleaned)  );
    } catch (error) {
      console.log('Error writing cleaned-up backup to disk: ', error.stack);
    }
  }

  /**
  * Import data from JSON into an IndexedDB database. This does not delete any existing data
  *  from the database, so keys could clash
  *
  * @param {IDBDatabase} idb_db
  * @param {string} jsonString - data to import, one key per object store
  */
  function importFromJsonString(idb_db, jsonString, path, options) {
    options = options || {};
    _.defaults(options, {
      forceLightImport: false,
      conversationLookup: {},
      groupLookup: {},
    });

    var conversationLookup = options.conversationLookup;
    var groupLookup = options.groupLookup;
    var result = {
      fullImport: true,
    };

    return new Promise(function(resolve, reject) {
      var importObject = JSON.parse(jsonString);
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
      eliminateClientConfigInBackup(importObject, path);

      var storeNames = _.keys(importObject);
      console.log('Importing to these stores:', storeNames.join(', '));

      var finished = false;
      var finish = function(via) {
        console.log('non-messages import done via', via);
        if (finished) {
          resolve(result);
        }
        finished = true;
      };

      var transaction = idb_db.transaction(storeNames, 'readwrite');
      transaction.onerror = function(e) {
        handleDOMException(
          'importFromJsonString transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = finish.bind(null, 'transaction complete');

      _.each(storeNames, function(storeName) {
          console.log('Importing items for store', storeName);

          if (!importObject[storeName].length) {
            delete importObject[storeName];
            return;
          }

          var count = 0;
          var skipCount = 0;

          var finishStore = function() {
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

          _.each(importObject[storeName], function(toAdd) {
              toAdd = unstringify(toAdd);

              // skipping anything we already have in the database
              if (storeName === 'conversations' && conversationLookup[getConversationKey(toAdd)]) {
                skipCount++;
                count++;
                return;
              }
              if (storeName === 'groups' && groupLookup[getGroupKey(toAdd)]) {
                skipCount++;
                count++;
                return;
              }

              var request = transaction.objectStore(storeName).put(toAdd, toAdd.id);
              request.onsuccess = function(event) {
                count++;
                if (count == importObject[storeName].length) {
                  finishStore();
                }
              };
              request.onerror = function(e) {
                handleDOMException(
                  'importFromJsonString request error (store: ' + storeName + ')',
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
    });
  }

  function openDatabase() {
    var migrations = Whisper.Database.migrations;
    var version = migrations[migrations.length - 1].version;
    var DBOpenRequest = window.indexedDB.open('signal', version);

    return new Promise(function(resolve, reject) {
      // these two event handlers act on the IDBDatabase object,
      // when the database is opened successfully, or not
      DBOpenRequest.onerror = reject;
      DBOpenRequest.onsuccess = function() {
        resolve(DBOpenRequest.result);
      };

      // This event handles the event whereby a new version of
      // the database needs to be created Either one has not
      // been created before, or a new version number has been
      // submitted via the window.indexedDB.open line above
      DBOpenRequest.onupgradeneeded = reject;
    });
  }

  function createDirectory(parent, name) {
    return new Promise(function(resolve, reject) {
      var sanitized = sanitizeFileName(name);
      var targetDir = path.join(parent, sanitized);
      fs.mkdir(targetDir, function(error) {
        if (error) {
          return reject(error);
        }

        return resolve(targetDir);
      });
    });
  }

  function createFileAndWriter(parent, name) {
    return new Promise(function(resolve) {
      var sanitized = sanitizeFileName(name);
      var targetPath = path.join(parent, sanitized);
      var options = {
        flags: 'wx'
      };
      return resolve(fs.createWriteStream(targetPath, options));
    });
  }

  function readFileAsText(parent, name) {
    return new Promise(function(resolve, reject) {
      var targetPath = path.join(parent, name);
      fs.readFile(targetPath, 'utf8', function(error, string) {
        if (error) {
          return reject(error);
        }

        return resolve(string);
      });
    });
  }

  function readFileAsArrayBuffer(parent, name) {
    return new Promise(function(resolve, reject) {
      var targetPath = path.join(parent, name);
      // omitting the encoding to get a buffer back
      fs.readFile(targetPath, function(error, buffer) {
        if (error) {
          return reject(error);
        }

        // Buffer instances are also Uint8Array instances
        //   https://nodejs.org/docs/latest/api/buffer.html#buffer_buffers_and_typedarray
        return resolve(buffer.buffer);
      });
    });
  }

  function trimFileName(filename) {
    var components = filename.split('.');
    if (components.length <= 1) {
      return filename.slice(0, 30);
    }

    var extension = components[components.length - 1];
    var name = components.slice(0, components.length - 1);
    if (extension.length > 5) {
      return filename.slice(0, 30);
    }

    return name.join('.').slice(0, 24) + '.' + extension;
  }


  function getAttachmentFileName(attachment) {
    if (attachment.fileName) {
      return trimFileName(attachment.fileName);
    }

    var name = attachment.id;

    if (attachment.contentType) {
      var components = attachment.contentType.split('/');
      name += '.' + (components.length > 1 ? components[1] : attachment.contentType);
    }

    return name;
  }

  function readAttachment(parent, message, attachment) {
    return new Promise(function(resolve, reject) {
      var name = getAttachmentFileName(attachment);
      var sanitized = sanitizeFileName(name);
      var attachmentDir = path.join(parent, message.received_at.toString());

      return readFileAsArrayBuffer(attachmentDir, sanitized).then(function(contents) {
        attachment.data = contents;
        return resolve();
      }, reject);
    });
  }

  function writeAttachment(dir, attachment) {
    var filename = getAttachmentFileName(attachment);
    return createFileAndWriter(dir, filename).then(function(writer) {
      var stream = createOutputStream(writer);
      stream.write(new Buffer(attachment.data));
      return stream.close();
    });
  }

  function writeAttachments(parentDir, name, messageId, attachments) {
    return createDirectory(parentDir, messageId).then(function(dir) {
      return Promise.all(_.map(attachments, function(attachment) {
        return writeAttachment(dir, attachment);
      }));
    }).catch(function(error) {
      console.log(
        'writeAttachments: error exporting conversation',
        name,
        ':',
        error && error.stack ? error.stack : error
      );
      return Promise.reject(error);
    });
  }

  function sanitizeFileName(filename) {
    return filename.toString().replace(/[^a-z0-9.,+()'#\- ]/gi, '_');
  }

  function exportConversation(idb_db, name, conversation, dir) {
    console.log('exporting conversation', name);
    return createFileAndWriter(dir, 'messages.json').then(function(writer) {
      return new Promise(function(resolve, reject) {
        var transaction = idb_db.transaction('messages', 'readwrite');
        transaction.onerror = function(e) {
          handleDOMException(
            'exportConversation transaction error (conversation: ' + name + ')',
            transaction.error,
            reject
          );
        };
        transaction.oncomplete = function() {
          // this doesn't really mean anything - we may have attachment processing to do
        };

        var store = transaction.objectStore('messages');
        var index = store.index('conversation');
        var range = IDBKeyRange.bound([conversation.id, 0], [conversation.id, Number.MAX_VALUE]);

        var promiseChain = Promise.resolve();
        var count = 0;
        var request = index.openCursor(range);

        var stream = createOutputStream(writer);
        stream.write('{"messages":[');

        request.onerror = function(e) {
          handleDOMException(
            'exportConversation request error (conversation: ' + name + ')',
            request.error,
            reject
          );
        };
        request.onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
            var message = cursor.value;
            var messageId = message.received_at;
            var attachments = message.attachments;

            // skip message if it is disappearing, no matter the amount of time left
            if (message.expireTimer) {
              cursor.continue();
              return;
            }

            if (count !== 0) {
              stream.write(',');
            }

            message.attachments = _.map(attachments, function(attachment) {
              return _.omit(attachment, ['data']);
            });

            var jsonString = JSON.stringify(stringify(message));
            stream.write(jsonString);

            if (attachments && attachments.length) {
              var process = function() {
                return writeAttachments(dir, name, messageId, attachments);
              };
              promiseChain = promiseChain.then(process);
            }

            count += 1;
            cursor.continue();
          } else {
            stream.write(']}');

            var promise = stream.close();

            return promiseChain.then(promise).then(function() {
              console.log('done exporting conversation', name);
              return resolve();
            }, function(error) {
              console.log(
                'exportConversation: error exporting conversation',
                name,
                ':',
                error && error.stack ? error.stack : error
              );
              return reject(error);
            });
          }
        };
      });
    });
  }

  // Goals for directory names:
  //   1. Human-readable, for easy use and verification by user (names not just ids)
  //   2. Sorted just like the list of conversations in the left-pan (active_at)
  //   3. Disambiguated from other directories (active_at, truncated name, id)
  function getConversationDirName(conversation) {
    var name = conversation.active_at || 'never';
    if (conversation.name) {
      return name + ' (' + conversation.name.slice(0, 30) + ' ' + conversation.id + ')';
    } else {
      return name + ' (' + conversation.id + ')';
    }
  }

  // Goals for logging names:
  //   1. Can be associated with files on disk
  //   2. Adequately disambiguated to enable debugging flow of execution
  //   3. Can be shared to the web without privacy concerns (there's no global redaction
  //      logic for group ids, so we do it manually here)
  function getConversationLoggingName(conversation) {
    var name = conversation.active_at || 'never';
    if (conversation.type === 'private') {
      name += ' (' + conversation.id + ')';
    } else {
      name += ' ([REDACTED_GROUP]' + conversation.id.slice(-3) + ')';
    }
    return name;
  }

  function exportConversations(idb_db, parentDir) {
    return new Promise(function(resolve, reject) {
      var transaction = idb_db.transaction('conversations', 'readwrite');
      transaction.onerror = function(e) {
        handleDOMException(
          'exportConversations transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = function() {
        // not really very useful - fires at unexpected times
      };

      var promiseChain = Promise.resolve();
      var store = transaction.objectStore('conversations');
      var request = store.openCursor();
      request.onerror = function(e) {
        handleDOMException(
          'exportConversations request error',
          request.error,
          reject
        );
      };
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor && cursor.value) {
          var conversation = cursor.value;
          var dir = getConversationDirName(conversation);
          var name = getConversationLoggingName(conversation);

          var process = function() {
            return createDirectory(parentDir, dir).then(function(dir) {
              return exportConversation(idb_db, name, conversation, dir);
            });
          };

          console.log('scheduling export for conversation', name);
          promiseChain = promiseChain.then(process);
          cursor.continue();
        } else {
          console.log('Done scheduling conversation exports');
          return promiseChain.then(resolve, reject);
        }
      };
    });
  }

  function getDirectory(options) {
    return new Promise(function(resolve, reject) {
      var browserWindow = BrowserWindow.getFocusedWindow();
      var dialogOptions = {
        title: options.title,
        properties: ['openDirectory'],
        buttonLabel: options.buttonLabel
      };

      dialog.showOpenDialog(browserWindow, dialogOptions, function(directory) {
        if (!directory || !directory[0]) {
          var error = new Error('Error choosing directory');
          error.name = 'ChooseError';
          return reject(error);
        }

        return resolve(directory[0]);
      });
    });
  }

  function getDirContents(dir) {
    return new Promise(function(resolve, reject) {
      fs.readdir(dir, function(err, files) {
        if (err) {
          return reject(err);
        }

        files = _.map(files, function(file) {
          return path.join(dir, file);
        });

        resolve(files);
      });
    });
  }

  function loadAttachments(dir, message) {
    return Promise.all(_.map(message.attachments, function(attachment) {
      return readAttachment(dir, message, attachment);
    }));
  }

  function saveAllMessages(idb_db, messages) {
    if (!messages.length) {
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
      var finished = false;
      var finish = function(via) {
        console.log('messages done saving via', via);
        if (finished) {
          resolve();
        }
        finished = true;
      };

      var transaction = idb_db.transaction('messages', 'readwrite');
      transaction.onerror = function(e) {
        handleDOMException(
          'saveAllMessages transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = finish.bind(null, 'transaction complete');

      var store = transaction.objectStore('messages');
      var conversationId = messages[0].conversationId;
      var count = 0;

      _.forEach(messages, function(message) {
        var request = store.put(message, message.id);
        request.onsuccess = function(event) {
          count += 1;
          if (count === messages.length) {
            console.log(
              'Saved',
              messages.length,
              'messages for conversation',
              // Don't know if group or private conversation, so we blindly redact
              '[REDACTED]' + conversationId.slice(-3)
            );
            finish('puts scheduled');
          }
        };
        request.onerror = function(e) {
          handleDOMException(
            'saveAllMessages request error',
            request.error,
            reject
          );
        };
      });
    });
  }

  // To reduce the memory impact of attachments, we make individual saves to the
  //   database for every message with an attachment. We load the attachment for a
  //   message, save it, and only then do we move on to the next message. Thus, every
  //   message with attachments needs to be removed from our overall message save with the
  //   filter() call.
  function importConversation(idb_db, dir, options) {
    options = options || {};
    _.defaults(options, {messageLookup: {}});

    var messageLookup = options.messageLookup;
    var conversationId = 'unknown';
    var total = 0;
    var skipped = 0;

    return readFileAsText(dir, 'messages.json').then(function(contents) {
      var promiseChain = Promise.resolve();

      var json = JSON.parse(contents);
      if (json.messages && json.messages.length) {
        conversationId = '[REDACTED]' + (json.messages[0].conversationId || '').slice(-3);
      }
      total = json.messages.length;

      var messages = _.filter(json.messages, function(message) {
        message = unstringify(message);

        if (messageLookup[getMessageKey(message)]) {
          skipped++;
          return null;
        }

        if (message.attachments && message.attachments.length) {
          var process = function() {
            return loadAttachments(dir, message).then(function() {
              return saveAllMessages(idb_db, [message]);
            });
          };

          promiseChain = promiseChain.then(process);

          return null;
        }

        return message;
      });

      var promise = Promise.resolve();
      if (messages.length > 0) {
        promise = saveAllMessages(idb_db, messages);
      }

      return promise
        .then(function() {
          return promiseChain;
        })
        .then(function() {
          console.log(
            'Finished importing conversation',
            conversationId,
            'Total:',
            total,
            'Skipped:',
            skipped
          );
        });

    }, function() {
      console.log('Warning: could not access messages.json in directory: ' + dir);
    });
  }

  function importConversations(idb_db, dir, options) {
    return getDirContents(dir).then(function(contents) {
      var promiseChain = Promise.resolve();

      _.forEach(contents, function(conversationDir) {
        if (!fs.statSync(conversationDir).isDirectory()) {
          return;
        }

        var process = function() {
          return importConversation(idb_db, conversationDir, options);
        };

        promiseChain = promiseChain.then(process);
      });

      return promiseChain;
    });
  }

  function getMessageKey(message) {
    var ourNumber = textsecure.storage.user.getNumber();
    var source = message.source || ourNumber;
    if (source === ourNumber) {
      return source + ' ' + message.timestamp;
    }

    var sourceDevice = message.sourceDevice || 1;
    return source + '.' + sourceDevice + ' ' + message.timestamp;
  }
  function loadMessagesLookup(idb_db) {
    return assembleLookup(idb_db, 'messages', getMessageKey);
  }

  function getConversationKey(conversation) {
    return conversation.id;
  }
  function loadConversationLookup(idb_db) {
    return assembleLookup(idb_db, 'conversations', getConversationKey);
  }

  function getGroupKey(group) {
    return group.id;
  }
  function loadGroupsLookup(idb_db) {
    return assembleLookup(idb_db, 'groups', getGroupKey);
  }

  function assembleLookup(idb_db, storeName, keyFunction) {
    var lookup = Object.create(null);

    return new Promise(function(resolve, reject) {
      var transaction = idb_db.transaction(storeName, 'readwrite');
      transaction.onerror = function(e) {
        handleDOMException(
          'assembleLookup(' + storeName + ') transaction error',
          transaction.error,
          reject
        );
      };
      transaction.oncomplete = function() {
        // not really very useful - fires at unexpected times
      };

      var promiseChain = Promise.resolve();
      var store = transaction.objectStore(storeName);
      var request = store.openCursor();
      request.onerror = function(e) {
        handleDOMException(
          'assembleLookup(' + storeName + ') request error',
          request.error,
          reject
        );
      };
      request.onsuccess = function(event) {
        var cursor = event.target.result;
        if (cursor && cursor.value) {
          lookup[keyFunction(cursor.value)] = true;
          cursor.continue();
        } else {
          console.log('Done creating ' + storeName + ' lookup');
          return resolve(lookup);
        }
      };
    });
  }

  function clearAllStores(idb_db) {
    return new Promise(function(resolve, reject) {
      console.log('Clearing all indexeddb stores');
      var storeNames = idb_db.objectStoreNames;
      var transaction = idb_db.transaction(storeNames, 'readwrite');

      var finished = false;
      var finish = function(via) {
        console.log('clearing all stores done via', via);
        if (finished) {
          resolve();
        }
        finished = true;
      };

      transaction.oncomplete = finish.bind(null, 'transaction complete');
      transaction.onerror = function(e) {
        handleDOMException(
          'clearAllStores transaction error',
          transaction.error,
          reject
        );
      };

      var count = 0;
      _.forEach(storeNames, function(storeName) {
        var store = transaction.objectStore(storeName);
        var request = store.clear();

        request.onsuccess = function() {
          count += 1;
          console.log('Done clearing store', storeName);

          if (count >= storeNames.length) {
            console.log('Done clearing all indexeddb stores');
            return finish('clears complete');
          }
        };

        request.onerror = function(e) {
          handleDOMException(
            'clearAllStores request error',
            request.error,
            reject
          );
        };
      });
    });
  }

  function getTimestamp() {
    return moment().format('YYYY MMM Do [at] h.mm.ss a');
  }

  // directories returned and taken by backup/import are all string paths
  Whisper.Backup = {
    clearDatabase: function() {
      return openDatabase().then(function(idb_db) {
        return clearAllStores(idb_db);
      });
    },
    getDirectoryForExport: function() {
      var options = {
        title: i18n('exportChooserTitle'),
        buttonLabel: i18n('exportButton'),
      };
      return getDirectory(options);
    },
    backupToDirectory: function(directory, options) {
      var dir;
      var idb;
      return openDatabase().then(function(idb_db) {
        idb = idb_db;
        var name = 'Signal Export ' + getTimestamp();
        return createDirectory(directory, name);
      }).then(function(created) {
        dir = created;
        return exportNonMessages(idb, dir, options);
      }).then(function() {
        return exportConversations(idb, dir);
      }).then(function() {
        return dir;
      }).then(function(path) {
        console.log('done backing up!');
        return path;
      }, function(error) {
        console.log(
          'the backup went wrong:',
          error && error.stack ? error.stack : error
        );
        return Promise.reject(error);
      });
    },
    getDirectoryForImport: function() {
      var options = {
        title: i18n('importChooserTitle'),
        buttonLabel: i18n('importButton'),
      };
      return getDirectory(options);
    },
    importFromDirectory: function(directory, options) {
      options = options || {};

      var idb, nonMessageResult;
      return openDatabase().then(function(idb_db) {
        idb = idb_db;

        return Promise.all([
          loadMessagesLookup(idb_db),
          loadConversationLookup(idb_db),
          loadGroupsLookup(idb_db),
        ]);
      }).then(function(lookups) {
        options.messageLookup = lookups[0];
        options.conversationLookup = lookups[1];
        options.groupLookup = lookups[2];
      }).then(function() {
        return importNonMessages(idb, directory, options);
      }).then(function(result) {
        nonMessageResult = result;
        return importConversations(idb, directory, options);
      }).then(function() {
        console.log('done restoring from backup!');
        return nonMessageResult;
      }, function(error) {
        console.log(
          'the import went wrong:',
          error && error.stack ? error.stack : error
        );
        return Promise.reject(error);
      });
    },
    // for testing
    handleDOMException,
    sanitizeFileName,
    trimFileName,
    getAttachmentFileName,
    getConversationDirName,
    getConversationLoggingName,
  };

}());
