;(function () {
  'use strict';
  window.Whisper = window.Whisper || {};

  function stringToBlob(string) {
    if (string === null || string === undefined) {
      console.log('stringToBlob: replacing null/undefined with empty string');
      string = '';
    }
    if (string.type === 'ArrayBuffer' && string.encoding === 'base64') {
      console.log('stringToBlob: Processing base64 attachment data');
      string = dcodeIO.ByteBuffer.wrap(string.data, 'base64').toArrayBuffer();
    }
    if (typeof string !== 'string' && !(string instanceof ArrayBuffer)) {
      // Not sure what this is, but perhaps we can make the right thing happen by sending
      //   it to a Uint8Array, which the wrap() method below handles just fine. Uint8Array
      //   can take an ArrayBuffer, so it will help if I'm right that the weird attachment
      //   data is an ArrayBuffer-like thing, while not being technically an instanceof.
      console.log('stringToBlob: sending strange object to Uint8Array --', typeof string, JSON.stringify(string), string);
      string = new Uint8Array(string);
    }
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
    return {
      write: function(string) {
        wait = wait.then(function() {
          return new Promise(function(resolve, reject) {
            fileWriter.onwriteend = resolve;
            fileWriter.onerror = reject;
            fileWriter.onabort = reject;
            fileWriter.write(stringToBlob(string));
          });
        });
        return wait;
      }
    };
  }

  function exportNonMessages(idb_db, parent) {
    // We wouldn't want to overwrite another db file.
    var exclusive = true;
    return createFileAndWriter(parent, 'db.json', exclusive).then(function(writer) {
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
        var transaction = idb_db.transaction(storeNames, "readwrite");
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
              stream.write('}').then(function() {
                console.log('Finished writing all stores to disk');
                resolve();
              }, function(error) {
                console.log(
                  'Failed to write db.json to disk',
                  error && error.stack ? error.stack : error
                );
                reject(error);
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

      console.log('Importing to these stores:', storeNames);

      var transaction = idb_db.transaction(storeNames, "readwrite");
      transaction.onerror = reject;

      _.each(storeNames, function(storeName) {
          console.log('Importing items for store', storeName);
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

  function createDirectory(parent, name, exclusive) {
    var sanitized = sanitizeFileName(name);
    console._log('-- about to create directory', sanitized);
    return new Promise(function(resolve, reject) {
      parent.getDirectory(sanitized, {create: true, exclusive: exclusive}, resolve, reject);
    });
  }

  function createFileAndWriter(parent, name, exclusive) {
    var sanitized = sanitizeFileName(name);
    console._log('-- about to create file', sanitized);
    return new Promise(function(resolve, reject) {
      parent.getFile(sanitized, {create: true, exclusive: exclusive}, function(file) {
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
    var name = getAttachmentFileName(attachment);
    var sanitized = sanitizeFileName(name);
    var attachmentDir = message.received_at;
    return new Promise(function(resolve, reject) {
      parent.getDirectory(attachmentDir, {create: false, exclusive: true}, function(dir) {
        return readFileAsArrayBuffer(dir, sanitized ).then(function(contents) {
          attachment.data = contents;
          return resolve();
        }, reject);
      }, reject);
    });
  }

  var attachments = 0;
  var failedAttachments = 0;

  function writeAttachment(dir, attachment) {
    attachments += 1;

    var filename = getAttachmentFileName(attachment);
    // If attachments are in messages with the same received_at and the same name,
    //   then we'll let that overwrite happen. It should be very uncommon.
    var exclusive = false;
    return createFileAndWriter(dir, filename, exclusive).then(function(writer) {
      var stream = createOutputStream(writer);
      return stream.write(attachment.data);
    }).catch(function(error) {
      failedAttachments += 1;
      console.log('writeAttachment error:', error && error.stack ? error.stack : error);
    });
  }

  function writeAttachments(parentDir, name, messageId, attachments) {
    // We've had a lot of trouble with attachments, likely due to messages with the same
    //   received_at in the same conversation. So we sacrifice one of the attachments in
    //   this unusual case.
    var exclusive = false;
    return createDirectory(parentDir, messageId, exclusive).then(function(dir) {
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

  var conversations = 0;
  var failedConversations = 0;

  function delay(ms) {
    console.log('Waiting', ms, 'milliseconds');
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Because apparently we sometimes create malformed JSON files. Let's double-check them.
  function checkConversation(conversationId, dir) {
    return delay(10000).then(function() {
      console.log('Verifying messages.json produced for conversation', conversationId);
      return readFileAsText(dir, 'messages.json');
    }).then(function(contents) {
      try {
        conversations += 1;
        JSON.parse(contents);
      }
      catch (error) {
        failedConversations += 1;
        console.log(
          'Export of conversation',
          conversationId,
          'was malformed:',
          error && error.stack ? error.stack : error
        );
      }
    });
  }

  function exportConversation(idb_db, name, conversation, dir) {
    console.log('exporting conversation', name);
    // We wouldn't want to overwrite the contents of a different conversation.
    var exclusive = true;
    return createFileAndWriter(dir, 'messages.json', exclusive).then(function(writer) {
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

            if (attachments && attachments.length) {
              var process = function() {
                console._log('-- writing attachments for message', message.id);
                if (!message.received_at) {
                  return Promise.reject(new Error('Message', message.id, 'had no received_at'));
                }
                return writeAttachments(dir, name, messageId, attachments);
              };
              promiseChain = promiseChain.then(process);
            }

            count += 1;
            cursor.continue();
          } else {
            var promise = stream.write(']}');
            promiseChain = promiseChain
              .then(promise)
              .then(checkConversation.bind(null, name, dir));

            return promiseChain.then(function() {
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
  //   2. Sorted just like the list of conversations in the left pane (active_at)
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
      var transaction = idb_db.transaction('conversations', "readwrite");
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
            // If we have a conversation directory collision, the user will lose the
            //   contents of the first conversation. So we throw an error.
            var exclusive = true;
            return createDirectory(parentDir, dir, exclusive).then(function(dir) {
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

  function getDirectory() {
    return new Promise(function(resolve, reject) {
      var w = extension.windows.getViews()[0];
      if (!w || !w.chrome || !w.chrome.fileSystem) {
        return reject(new Error('Ran into problem accessing Chrome filesystem API'));
      }

      w.chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(entry) {
        if (!entry) {
          var error = new Error('Error choosing directory');
          error.name = 'ChooseError';
          return reject(error);
        }

        return resolve(entry);
      });
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

  function saveAllMessages(idb_db, messages) {
    if (!messages.length) {
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
      var transaction = idb_db.transaction('messages', "readwrite");
      transaction.onerror = function(e) {
        console.log(
          'importConversations transaction error:',
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
              // Don't know if group or private conversation, so we blindly redact
              '[REDACTED]' + conversationId.slice(-3)
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
      console.log('Warning: could not access messages.json in directory: ' + dir.fullPath);
    });
  }

  function importConversations(idb_db, dir) {
    return getDirContents(dir).then(function(contents) {
      var promiseChain = Promise.resolve();

      _.forEach(contents, function(conversationDir) {
        if (!conversationDir.isDirectory) {
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

  function getDisplayPath(entry) {
    return new Promise(function(resolve) {
      chrome.fileSystem.getDisplayPath(entry, function(path) {
        return resolve(path);
      });
    });
  }

  function getTimestamp() {
    return moment().format('YYYY MMM Do [at] h.mm.ss a');
  }

  function printAttachmentStats() {
    console.log(
      'Total attachments:', attachments,
      'Failed attachments:', failedAttachments
    );
  }

  function printConversationStats() {
    console.log(
      'Total conversations:', conversations,
      'Failed conversations:', failedConversations
    );
  }

  Whisper.Backup = {
    backupToDirectory: function() {
      return getDirectory().then(function(directoryEntry) {
        var idb;
        var dir;
        return openDatabase().then(function(idb_db) {
          idb = idb_db;
          var name = 'Signal Export ' + getTimestamp();
          // We don't want to overwrite another signal export, so we set exclusive = true
          var exclusive = true;
          return createDirectory(directoryEntry, name, exclusive);
        }).then(function(directory) {
          dir = directory;
          return exportNonMessages(idb, dir);
        }).then(function() {
          return exportConversations(idb, dir);
        }).then(function() {
          return getDisplayPath(dir);
        });
      }).then(function(path) {
        printAttachmentStats();
        printConversationStats();
        console.log('done backing up!');
        if (failedAttachments) {
          throw new Error('Export failed, one or more attachments failed');
        }
        if (failedConversations) {
          throw new Error('Export failed, one or more conversations failed');
        }
        return path;
      }, function(error) {
        printAttachmentStats();
        printConversationStats();
        console.log(
          'the backup went wrong:',
          error && error.stack ? error.stack : error
        );
        return Promise.reject(error);
      });
    },
    importFromDirectory: function() {
      return getDirectory().then(function(directoryEntry) {
        var idb;
        return openDatabase().then(function(idb_db) {
          idb = idb_db;
          return importNonMessages(idb_db, directoryEntry);
        }).then(function() {
          return importConversations(idb, directoryEntry);
        }).then(function() {
          return displayPath(directoryEntry);
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
    },
    // for testing
    sanitizeFileName: sanitizeFileName,
    trimFileName: trimFileName,
    getAttachmentFileName: getAttachmentFileName,
    getConversationDirName: getConversationDirName,
    getConversationLoggingName: getConversationLoggingName
  };

}());
