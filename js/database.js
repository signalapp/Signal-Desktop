/* global Whisper: false */
/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  window.Whisper.Database = window.Whisper.Database || {};
  window.Whisper.Database.id = window.Whisper.Database.id || 'signal';
  window.Whisper.Database.nolog = true;

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
