;(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  function stringToBlob(string) {
    var buffer = dcodeIO.ByteBuffer.wrap(string).toArrayBuffer();
    return new Blob([buffer]);
  }

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

  function createOutputStream(fileWriter) {
    var wait = Promise.resolve();
    var count = 0;
    return {
      write: function(string) {
        var i = count++;
        wait = wait.then(function() {
          return new Promise(function(resolve, reject) {
            fileWriter.onwriteend = resolve;
            fileWriter.onerror = reject;
            fileWriter.onabort = reject;
            fileWriter.write(stringToBlob(string));
          });
        });
        return wait;
      },
      wait: function() {
        return wait;
      }
    };
  }

  /**
  * Export all data from an IndexedDB database
  * @param {IDBDatabase} idb_db
  */
  function exportToJsonFile(idb_db, fileWriter) {
    var storeNames = idb_db.objectStoreNames;
    storeNames = _.without(storeNames, 'messages');
    var exportedStoreNames = [];
    console.log('Exporting', storeNames.join(', '));
    if (storeNames.length === 0) {
      throw new Error('No stores to export');
    }

    var stream = createOutputStream(fileWriter);

    stream.write('{');

    _.each(storeNames, function(storeName) {
      var transaction = idb_db.transaction(storeNames, "readwrite");
      transaction.onerror = function(e) { console.log(e); };
      transaction.oncomplete = function() { console.log('complete'); };

      var store = transaction.objectStore(storeName);
      var request = store.openCursor();
      var count = 0;
      request.onerror = function(e) { console.log(e); };
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
          console.log('Exported', count, storeName);

          exportedStoreNames.push(storeName);
          if (exportedStoreNames.length < storeNames.length) {
            stream.write(',');
          } else {
            console.log('Exported all stores');
            stream.write('}').then(function() {
              console.log('finished writing');
            });
          }
        }
      };
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
    console.log('Beginning import');
    return new Promise(function(resolve, reject) {
      var transaction = idb_db.transaction(idb_db.objectStoreNames, "readwrite");
      transaction.onerror = reject;
      var importObject = JSON.parse(jsonString);
      _.each(idb_db.objectStoreNames, function(storeName) {
          console.log('Importing', storeName);
          var count = 0;
          _.each(importObject[storeName], function(toAdd) {
              toAdd = unstringify(toAdd);
              console.log('Importing', toAdd);
              var request = transaction.objectStore(storeName).put(toAdd, toAdd.id);
              request.onsuccess = function(event) {
                count++;
                console.log(count);
                if (count == importObject[storeName].length) {
                  // added all objects for this store
                  delete importObject[storeName];
                  if (_.keys(importObject).length === 0) {
                    // added all object stores
                    console.log('Import complete');
                    resolve();
                  }
                }
              };
              request.onerror = function(event) {
                console.log('Error adding object to store');
                console.log(event.target.error);
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

  function chooseFile(type) {
    return new Promise(function(resolve, reject) {
      type = type || 'openFile';
      var w = extension.windows.getViews()[0];
      if (w && w.chrome && w.chrome.fileSystem) {
        w.chrome.fileSystem.chooseEntry({
          type: type, suggestedName: 'signal-desktop-backup.json'
        }, function(entry) {
          if (!entry) {
            reject();
          } else {
            resolve(entry);
          }
        });
      }
    });
  }

  function getFileWriter() {
    console.log('Selecting location to save backup file');
    return chooseFile('saveFile').then(function(entry) {
      return new Promise(function(resolve, reject) {
        entry.createWriter(function(fileWriter) {
          resolve(fileWriter);
        }, reject);
      });
    });
  }

  function getFileString() {
    return chooseFile().then(function(entry) {
      return new Promise(function(resolve, reject) {
        var file = entry.file(function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            resolve(e.target.result);
          };
          reader.onerror = reject;
          reader.onabort = reject;
          reader.readAsText(file);
        }, reject);
      });
    });
  }

  function createDirectory(parent, name) {
    var sanitized = sanitizeFileName(name);
    return new Promise(function(resolve, reject) {
      parent.getDirectory(sanitized, {create: true, exclusive: true}, resolve, reject);
    });
  }

  function createFileAndWriter(parent, name) {
    var sanitized = sanitizeFileName(name);
    return new Promise(function(resolve, reject) {
      parent.getFile(sanitized, {create: true, exclusive: true}, function(file) {
        return file.createWriter(function(writer) {
          resolve(writer);
        }, reject);
      }, reject);
    });
  }

  function readFileAsText(parent, name) {
    return new Promise(function(resolve, reject) {
      parent.getFile(name, {create: false, exclusive: true}, function(fileEntry) {
        fileEntry.file(function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            resolve(e.target.result);
          };
          reader.onerror = reject;
          reader.onabort = reject;
          reader.readAsText(file);
        }, reject);
      }, reject);
    });
  }

  function readFileAsArrayBuffer(parent, name) {
    return new Promise(function(resolve, reject) {
      parent.getFile(name, {create: false, exclusive: true}, function(fileEntry) {
        fileEntry.file(function(file) {
          var reader = new FileReader();
          reader.onload = function(e) {
            resolve(e.target.result);
          };
          reader.onerror = reject;
          reader.onabort = reject;
          reader.readAsArrayBuffer(file);
        }, reject);
      }, reject);
    });
  }

  function getAttachmentFileName(attachment) {
    return attachment.fileName || (attachment.id + '.' + attachment.contentType.split('/')[1]);
  }

  function readAttachment(parent, message, attachment) {
    var name = getAttachmentFileName(attachment);
    var sanitized = sanitizeFileName(name);
    var attachmentDir = message.received_at;
    return new Promise(function(resolve, reject) {
      parent.getDirectory(attachmentDir, {create: false, exclusive: true}, function(dir) {
        return readFileAsArrayBuffer(dir, sanitized ).then(function(contents) {
          attachment.data = contents;
          return resolve()
        }, reject);
      }, reject);
    });
  }

  function writeAttachment(dir, attachment) {
    var filename = getAttachmentFileName(attachment);
    return createFileAndWriter(dir, filename).then(function(writer) {
      var stream = createOutputStream(writer);
      stream.write(attachment.data);
    });
  }

  function writeAttachments(parentDir, name, messageId, attachments) {
    console.log('writeAttachments: starting conversation', name);
    return createDirectory(parentDir, messageId).then(function(dir) {
      return Promise.all(_.map(attachments, function(attachment) {
        return writeAttachment(dir, attachment);
      }));
    }).then(function() {
      console.log('writeAttachments: done exporting conversation', name);
    }, function(error) {
      console.log(
        'writeAttachments: error exporting conversation',
        name,
        ':',
        error && error.stack ? error.stack : error
      );
      return Promise.reject(error);
    });
  }

  function arrayBufferToString(arrayBuffer) {
      return new dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('binary');
  }

  function stringToArrayBuffer(string) {
      return new dcodeIO.ByteBuffer.wrap(string, 'binary').toArrayBuffer();
  }

  function sanitizeFileName(filename) {
    return filename.toString().replace(/[^a-z0-9.:+()'"#\- ]/gi, '_');
  }

  function exportConversation(idb_db, name, conversation, dir) {
    console.log('exporting conversation', name);
    return createFileAndWriter(dir, 'messages.json').then(function(writer) {
      return new Promise(function(resolve, reject) {

        var transaction = idb_db.transaction('messages', "readwrite");
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
            return promiseChain.then(function() {
              console.log('exportConversation: done exporting conversation', name);
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
      var transaction = idb_db.transaction('conversations', "readwrite");
      transaction.onerror = function(e) {
        console.log(
          'exportConversations: transaction error:',
          e && e.stack ? e.stack : e
        );
        return reject(e);
      };
      transaction.oncomplete = function() {
        console.log('done scheduling conversation exports');
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
          }
          console.log('scheduling conversation', name);

          promiseChain = promiseChain.then(process);
          cursor.continue();
        } else {
          return promiseChain.then(resolve, reject);
        }
      };
    });
  }

  function getDirectory() {
    return new Promise(function(resolve, reject) {
      var w = extension.windows.getViews()[0];
      if (w && w.chrome && w.chrome.fileSystem) {
        w.chrome.fileSystem.chooseEntry({
          type: 'openDirectory'
        }, function(entry) {
          if (!entry) {
            reject();
          } else {
            resolve(entry);
          }
        });
      }
    });
  }

  function getDirContents(dir) {
    return new Promise(function(resolve, reject) {
      var reader = dir.createReader();
      var contents = [];

      var getContents = function() {
        reader.readEntries(function(results) {
          if (results.length) {
            contents = contents.concat(results);
            getContents();
          } else {
            return resolve(contents);
          }
        }, function(error) {
          return reject(error);
        });
      };

      getContents();
    });
  }

  function loadAttachments(dir, message) {
    return Promise.all(_.map(message.attachments, function(attachment) {
      return readAttachment(dir, message, attachment);
    }));
  }

  function saveAllMessages(store, messages) {
    if (!messages.length) {
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
      var conversationId = messages[0].conversationId;
      console.log('saving', messages.length, 'messages for conversation', conversationId);
      var count = 0;

      _.forEach(messages, function() {
        var request = store.put(message, message.id);
        request.onsuccess = function(event) {
          count += 1;
          if (count === messages.length) {
            console.log('Done saving messages for conversation', conversationId);
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

  function importConversation(store, dir) {
    return readFileAsText(dir, 'messages.json').then(function(contents) {
      var promiseChain = Promise.resolve();

      var json = JSON.parse(contents);
      var messages = json.messages;
      _.forEach(messages, function(message) {
        message = unstringify(message);

        if (message.attachments && message.attachments.length) {
          var process = function() {
            return loadAttachments(dir, message);
          }

          promiseChain = promiseChain.then(process);
        }
      });

      return promiseChain.then(function() {
        return saveAllMessages(store, messages);
      });
    });
  }

  function importConversations(idb_db, dir) {
    return getDirContents(dir).then(function(contents) {
      var transaction = idb_db.transaction('messages', "readwrite");
      transaction.onerror = function(e) {
        console.log(
          'importConversations transaction error:',
          e && e.stack ? e.stack : e
        );
        return reject(e);
      };
      var store = transaction.objectStore('messages');
      var promiseChain = Promise.resolve();

      _.forEach(contents, function(conversationDir) {
        if (!conversationDir.isDirectory) {
          return;
        }

        var process = function() {
          return importConversation(store, conversationDir);
        };

        promiseChain = promiseChain.then(process);
      });

      return promiseChain;
    });
  }

  Whisper.Backup = {
    backupMessages: function() {
      return getDirectory().then(function(directoryEntry) {
        return openDatabase().then(function(idb_db) {
          return exportConversations(idb_db, directoryEntry);
        });
      }).then(function() {
        console.log('done backing up all messages and attachments');
      }, function(error) {
        console.log(
          'the whole thing went wrong',
          error && error.stack ? error.stack : error
        );
      });
    },
    importMessages: function() {
      return getDirectory().then(function(directoryEntry) {
        return openDatabase().then(function(idb_db) {
          return importConversations(idb_db, directoryEntry);
        });
      }).then(function() {
        console.log('done restoring all messages and attachments');
      }, function(error) {
        console.log(
          'the whole thing went wrong',
          error && error.stack ? error.stack : error
        );
      });
    },
    createBackupFile: function() {
      return getFileWriter().then(function(fileWriter) {
        return openDatabase().then(function(db) {
          return exportToJsonFile(db, fileWriter);
        });
      }).catch(function(error) {
        console.log(error);
      });
    },
    restoreFromBackupFile: function() {
      return getFileString().then(function(jsonString) {
        return openDatabase().then(function(db) {
          return importFromJsonString(db, jsonString);
        });
      }).catch(function(error) {
        console.log(error);
      });
    }
  };

}());
