/* global Whisper: false */
/* global Backbone: false */
/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  window.Whisper.Database = window.Whisper.Database || {};
  window.Whisper.Database.id = window.Whisper.Database.id || 'signal';
  window.Whisper.Database.nolog = true;

  Whisper.Database.handleDOMException = (prefix, error, reject) => {
    console.log(
      `${prefix}:`,
      error && error.name,
      error && error.message,
      error && error.code
    );
    reject(error || new Error(prefix));
  };

  function clearStores(db, names) {
    return new Promise(((resolve, reject) => {
      const storeNames = names || db.objectStoreNames;
      console.log('Clearing these indexeddb stores:', storeNames);
      const transaction = db.transaction(storeNames, 'readwrite');

      let finished = false;
      const finish = (via) => {
        console.log('clearing all stores done via', via);
        if (finished) {
          resolve();
        }
        finished = true;
      };

      transaction.oncomplete = finish.bind(null, 'transaction complete');
      transaction.onerror = () => {
        Whisper.Database.handleDOMException(
          'clearStores transaction error',
          transaction.error,
          reject
        );
      };

      let count = 0;
      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          count += 1;
          console.log('Done clearing store', storeName);

          if (count >= storeNames.length) {
            console.log('Done clearing all indexeddb stores');
            finish('clears complete');
          }
        };

        request.onerror = () => {
          Whisper.Database.handleDOMException(
            'clearStores request error',
            request.error,
            reject
          );
        };
      });
    }));
  }

  Whisper.Database.open = () => {
    const { migrations } = Whisper.Database;
    const { version } = migrations[migrations.length - 1];
    const DBOpenRequest = window.indexedDB.open(Whisper.Database.id, version);

    return new Promise(((resolve, reject) => {
      // these two event handlers act on the IDBDatabase object,
      // when the database is opened successfully, or not
      DBOpenRequest.onerror = reject;
      DBOpenRequest.onsuccess = () => resolve(DBOpenRequest.result);

      // This event handles the event whereby a new version of
      // the database needs to be created Either one has not
      // been created before, or a new version number has been
      // submitted via the window.indexedDB.open line above
      DBOpenRequest.onupgradeneeded = reject;
    }));
  };

  Whisper.Database.clear = async () => {
    const db = await Whisper.Database.open();
    return clearStores(db);
  };

  Whisper.Database.clearStores = async (storeNames) => {
    const db = await Whisper.Database.open();
    return clearStores(db, storeNames);
  };

  Whisper.Database.close = () => window.wrapDeferred(Backbone.sync('closeall'));

  Whisper.Database.drop = () =>
    new Promise(((resolve, reject) => {
      const request = window.indexedDB.deleteDatabase(Whisper.Database.id);

      request.onblocked = () => {
        reject(new Error('Error deleting database: Blocked.'));
      };
      request.onupgradeneeded = () => {
        reject(new Error('Error deleting database: Upgrade needed.'));
      };
      request.onerror = () => {
        reject(new Error('Error deleting database.'));
      };

      request.onsuccess = resolve;
    }));

  Whisper.Database.migrations = [
    {
      version: '12.0',
      migrate(transaction, next) {
        console.log('migration 1.0');
        console.log('creating object stores');
        const messages = transaction.db.createObjectStore('messages');
        messages.createIndex('conversation', ['conversationId', 'received_at'], {
          unique: false,
        });
        messages.createIndex('receipt', 'sent_at', { unique: false });
        messages.createIndex('unread', ['conversationId', 'unread'], { unique: false });
        messages.createIndex('expires_at', 'expires_at', { unique: false });

        const conversations = transaction.db.createObjectStore('conversations');
        conversations.createIndex('inbox', 'active_at', { unique: false });
        conversations.createIndex('group', 'members', {
          unique: false,
          multiEntry: true,
        });
        conversations.createIndex('type', 'type', {
          unique: false,
        });
        conversations.createIndex('search', 'tokens', {
          unique: false,
          multiEntry: true,
        });

        transaction.db.createObjectStore('groups');

        transaction.db.createObjectStore('sessions');
        transaction.db.createObjectStore('identityKeys');
        transaction.db.createObjectStore('preKeys');
        transaction.db.createObjectStore('signedPreKeys');
        transaction.db.createObjectStore('items');

        console.log('creating debug log');
        transaction.db.createObjectStore('debug');

        next();
      },
    },
    {
      version: '13.0',
      migrate(transaction, next) {
        console.log('migration 13.0');
        console.log('Adding fields to identity keys');
        const identityKeys = transaction.objectStore('identityKeys');
        const request = identityKeys.openCursor();
        const promises = [];
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const attributes = cursor.value;
            attributes.timestamp = 0;
            attributes.firstUse = false;
            attributes.nonblockingApproval = false;
            attributes.verified = 0;
            promises.push(new Promise(((resolve, reject) => {
              const putRequest = identityKeys.put(attributes, attributes.id);
              putRequest.onsuccess = resolve;
              putRequest.onerror = (e) => {
                console.log(e);
                reject(e);
              };
            })));
            cursor.continue();
          } else {
            // no more results
            Promise.all(promises).then(() => {
              next();
            });
          }
        };
        request.onerror = (event) => {
          console.log(event);
        };
      },
    },
    {
      version: '14.0',
      migrate(transaction, next) {
        console.log('migration 14.0');
        console.log('Adding unprocessed message store');
        const unprocessed = transaction.db.createObjectStore('unprocessed');
        unprocessed.createIndex('received', 'timestamp', { unique: false });
        next();
      },
    },
    {
      version: '15.0',
      migrate(transaction, next) {
        console.log('migration 15.0');
        console.log('Adding messages index for de-duplication');
        const messages = transaction.objectStore('messages');
        messages.createIndex('unique', ['source', 'sourceDevice', 'sent_at'], {
          unique: true,
        });
        next();
      },
    },
    {
      version: '16.0',
      migrate(transaction, next) {
        console.log('migration 16.0');
        console.log('Dropping log table, since we now log to disk');
        transaction.db.deleteObjectStore('debug');
        next();
      },
    },
  ];
}());
