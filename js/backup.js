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
    console.log('Exporting', storeNames.toString());
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

  Whisper.Backup = {
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
