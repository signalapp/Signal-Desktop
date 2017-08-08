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

  function exportNonMessages(idb_db, parent) {
    return createFileAndWriter(parent, 'db.json').then(function(writer) {
      return exportToJsonFile(idb_db, writer);
    });
  }

  /**
  * Export all data from an IndexedDB database
  * @param {IDBDatabase} idb_db
  */
  function exportToJsonFile(idb_db, fileWriter) {
    return new Promise(function(resolve, reject) {
      var storeNames = idb_db.objectStoreNames;
      storeNames = _.without(storeNames, 'messages');
      var exportedStoreNames = [];
      if (storeNames.length === 0) {
        throw new Error('No stores to export');
      }
      console.log('Exporting from these stores:', storeNames.join(', '));

      var stream = createOutputStream(fileWriter);

      stream.write('{');

      _.each(storeNames, function(storeName) {
        var transaction = idb_db.transaction(storeNames, 'readwrite');
        transaction.onerror = function(error) {
          console.log(
            'exportToJsonFile: transaction error',
            error && error.stack ? error.stack : error
          );
          reject(error);
        };
        transaction.oncomplete = function() {
          console.log('transaction complete');
        };

        var store = transaction.objectStore(storeName);
        var request = store.openCursor();
        var count = 0;
        request.onerror = function(e) {
          console.log('Error attempting to export store', storeName);
          reject(e);
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

  function importNonMessages(idb_db, parent) {
    return readFileAsText(parent, 'db.json').then(function(string) {
      return importFromJsonString(idb_db, string);
    });
  }

  /**
  * Import data from JSON into an IndexedDB database. This does not delete any existing data
  *  from the database, so keys could clash
  *
  * @param {IDBDatabase} idb_db
  * @param {string} jsonString - data to import, one key per object store
  */
  function importFromJsonString(idb_db, jsonString) {
    return new Promise(function(resolve, reject) {
      var importObject = JSON.parse(jsonString);
      var storeNames = _.keys(importObject);

      console.log('Importing to these stores:', storeNames.join(', '));

      var transaction = idb_db.transaction(storeNames, 'readwrite');
      transaction.onerror = reject;

      _.each(storeNames, function(storeName) {
          console.log('Importing items for store', storeName);

          if (!importObject[storeName].length) {
            delete importObject[storeName];
            return;
          }

          var count = 0;
          _.each(importObject[storeName], function(toAdd) {
              toAdd = unstringify(toAdd);
              var request = transaction.objectStore(storeName).put(toAdd, toAdd.id);
              request.onsuccess = function(event) {
                count++;
                if (count == importObject[storeName].length) {
                  // added all objects for this store
                  delete importObject[storeName];
                  console.log('Done importing to store', storeName);
                  if (_.keys(importObject).length === 0) {
                    // added all object stores
                    console.log('DB import complete');
                    resolve();
                  }
                }
              };
              request.onerror = function(error) {
                console.log(
                  'Error adding object to store',
                  storeName,
                  ':',
                  toAdd
                );
                reject(error);
              };
          });
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

  function getAttachmentFileName(attachment) {
    return attachment.fileName || (attachment.id + '.' + attachment.contentType.split('/')[1]);
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
    return filename.toString().replace(/[^a-z0-9.,+()'"#\- ]/gi, '_');
  }

  function exportConversation(idb_db, name, conversation, dir) {
    console.log('exporting conversation', name);
    return createFileAndWriter(dir, 'messages.json').then(function(writer) {
      return new Promise(function(resolve, reject) {
        var transaction = idb_db.transaction('messages', 'readwrite');
        transaction.onerror = function(e) {
          console.log(
            'exportConversation transaction error for conversation',
            name,
            ':',
            e && e.stack ? e.stack : e
          );
          return reject(e);
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
          console.log(
            'exportConversation: error pulling messages for conversation',
            name,
            ':',
            e && e.stack ? e.stack : e
          );
          return reject(e);
        };
        request.onsuccess = function(event) {
          var cursor = event.target.result;
          if (cursor) {
            if (count !== 0) {
              stream.write(',');
            }

            var message = cursor.value;
            var messageId = message.received_at;
            var attachments = message.attachments;

            message.attachments = _.map(attachments, function(attachment) {
              return _.omit(attachment, ['data']);
            });

            var jsonString = JSON.stringify(stringify(message));
            stream.write(jsonString);

            if (attachments.length) {
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

  function getConversationDirName(conversation) {
    var name = conversation.active_at || 'never';
    if (conversation.type === 'private') {
      name += ' (' + (conversation.name || conversation.id) + ')';
    } else {
      name += ' (' + conversation.name + ')';
    }
    return name;
  }

  function getConversationLoggingName(conversation) {
    var name = conversation.active_at || 'never';
    name += ' (' + conversation.id + ')';
    return name;
  }

  function exportConversations(idb_db, parentDir) {
    return new Promise(function(resolve, reject) {
      var transaction = idb_db.transaction('conversations', 'readwrite');
      transaction.onerror = function(e) {
        console.log(
          'exportConversations: transaction error:',
          e && e.stack ? e.stack : e
        );
        return reject(e);
      };
      transaction.oncomplete = function() {
        // not really very useful - fires at unexpected times
      };

      var promiseChain = Promise.resolve();
      var store = transaction.objectStore('conversations');
      var request = store.openCursor();
      request.onerror = function(e) {
        console.log(
          'exportConversations: error pulling conversations:',
          e && e.stack ? e.stack : e
        );
        return reject(e);
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
      var transaction = idb_db.transaction('messages', 'readwrite');
      transaction.onerror = function(e) {
        console.log(
          'saveAllMessages transaction error:',
          e && e.stack ? e.stack : e
        );
        return reject(e);
      };

      var store = transaction.objectStore('messages');
      var conversationId = messages[0].conversationId;
      var count = 0;

      _.forEach(messages, function(message) {
        var request = store.put(message, message.id);
        request.onsuccess = function(event) {
          count += 1;
          if (count === messages.length) {
            console.log(
              'Done importing',
              messages.length,
              'messages for conversation',
              conversationId
            );
            resolve();
          }
        };
        request.onerror = function(event) {
          console.log('Error adding object to store:', error);
          reject();
        };
      });
    });
  }

  function importConversation(idb_db, dir) {
    return readFileAsText(dir, 'messages.json').then(function(contents) {
      var promiseChain = Promise.resolve();

      var json = JSON.parse(contents);
      var messages = json.messages;
      _.forEach(messages, function(message) {
        message = unstringify(message);

        if (message.attachments && message.attachments.length) {
          var process = function() {
            return loadAttachments(dir, message);
          };

          promiseChain = promiseChain.then(process);
        }
      });

      return promiseChain.then(function() {
        return saveAllMessages(idb_db, messages);
      });
    }, function() {
      console.log('Warning: could not access messages.json in directory: ' + dir);
    });
  }

  function importConversations(idb_db, dir) {
    return getDirContents(dir).then(function(contents) {
      var promiseChain = Promise.resolve();

      _.forEach(contents, function(conversationDir) {
        if (!fs.statSync(conversationDir).isDirectory()) {
          return;
        }

        var process = function() {
          return importConversation(idb_db, conversationDir);
        };

        promiseChain = promiseChain.then(process);
      });

      return promiseChain;
    });
  }

  function clearAllStores(idb_db) {
    return new Promise(function(resolve, reject) {
      console.log('Clearing all indexeddb stores');
      var storeNames = idb_db.objectStoreNames;
      var transaction = idb_db.transaction(storeNames, 'readwrite');

      transaction.oncomplete = function() {
        // unused
      };
      transaction.onerror = function(error) {
        console.log(
          'saveAllMessages transaction error:',
          error && error.stack ? error.stack : error
        );
        return reject(error);
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
            return resolve();
          }
        };

        request.onerror = function(error) {
          console.log(
            'clearAllStores transaction error:',
            error && error.stack ? error.stack : error
          );
          return reject(error);
        };
      });
    });
  }

  function getTimestamp() {
    return moment().format('YYYY MMM Do [at] h.mm.ss a');
  }

  Whisper.Backup = {
    clearDatabase: function() {
      return openDatabase().then(function(idb_db) {
        return clearAllStores(idb_db);
      });
    },
    backupToDirectory: function() {
      var options = {
        title: i18n('exportChooserTitle'),
        buttonLabel: i18n('exportButton'),
      };
      return getDirectory(options).then(function(directory) {
        var idb;
        var dir;
        return openDatabase().then(function(idb_db) {
          idb = idb_db;
          var name = 'Signal Export ' + getTimestamp();
          return createDirectory(directory, name);
        }).then(function(created) {
          dir = created;
          return exportNonMessages(idb, dir);
        }).then(function() {
          return exportConversations(idb, dir);
        }).then(function() {
          return dir;
        });
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
    importFromDirectory: function() {
      var options = {
        title: i18n('importChooserTitle'),
        buttonLabel: i18n('importButton'),
      };
      return getDirectory(options).then(function(directory) {
        var idb;
        return openDatabase().then(function(idb_db) {
          idb = idb_db;
          return importNonMessages(idb_db, directory);
        }).then(function() {
          return importConversations(idb, directory);
        }).then(function() {
          return directory;
        });
      }).then(function(path) {
        console.log('done restoring from backup!');
        return path;
      }, function(error) {
        console.log(
          'the import went wrong:',
          error && error.stack ? error.stack : error
        );
        return Promise.reject(error);
      });
    }
  };

}());
