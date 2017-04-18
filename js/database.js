/*
 * vim: ts=4:sw=4:expandtab
 */

(function () {
    'use strict';
    window.Whisper             = window.Whisper             || {};
    window.Whisper.Database    = window.Whisper.Database    || {};
    window.Whisper.Database.id = window.Whisper.Database.id || 'signal';
    window.Whisper.Database.nolog = true;

    Whisper.Database.migrations = [
        {
            version: "12.0",
            migrate: function(transaction, next) {
                console.log('migration 1.0');
                console.log('creating object stores');
                var messages = transaction.db.createObjectStore("messages");
                messages.createIndex("conversation", ["conversationId", "received_at"], { unique: false });
                messages.createIndex("receipt", "sent_at", { unique: false });
                messages.createIndex('unread', ['conversationId', 'unread'], { unique: false });
                messages.createIndex('expires_at', 'expires_at', { unique: false });

                var conversations = transaction.db.createObjectStore("conversations");
                conversations.createIndex("inbox", "active_at", { unique: false });
                conversations.createIndex("group", "members", { unique: false, multiEntry: true });
                conversations.createIndex("type", "type", { unique: false });
                conversations.createIndex("search", "tokens", { unique: false, multiEntry: true });

                var groups = transaction.db.createObjectStore('groups');

                var sessions = transaction.db.createObjectStore('sessions');
                var identityKeys = transaction.db.createObjectStore('identityKeys');
                var preKeys = transaction.db.createObjectStore("preKeys");
                var signedPreKeys = transaction.db.createObjectStore("signedPreKeys");
                var items = transaction.db.createObjectStore("items");

                console.log('creating debug log');
                var debugLog = transaction.db.createObjectStore("debug");

                next();
            }
        },
        {
            version: "13.0",
            migrate: function(transaction, next) {
                console.log('migration 13.0');
                console.log('Adding fields to identity keys');
                var identityKeys = transaction.objectStore('identityKeys');
                var request = identityKeys.openCursor();
                var promises = [];
                request.onsuccess = function(event) {
                  var cursor = event.target.result;
                  if (cursor) {
                    var attributes = cursor.value;
                    attributes.timestamp = 0;
                    attributes.firstUse = false;
                    attributes.nonblockingApproval = false;
                    attributes.verified = 0;
                    promises.push(new Promise(function(resolve, reject) {
                      var putRequest = identityKeys.put(attributes, attributes.id);
                      putRequest.onsuccess = resolve;
                      putRequest.onerror = function(e) {
                        console.log(e);
                        reject(e);
                      };
                    }));
                    cursor.continue();
                  } else {
                    // no more results
                    Promise.all(promises).then(function() {
                      next();
                    });
                  }
                };
                request.onerror = function(event) {
                  console.log(event);
                };
            }
        },
        {
            version: "14.0",
            migrate: function(transaction, next) {
                console.log('migration 14.0');
                console.log('Adding unprocessed message store');
                var unprocessed = transaction.db.createObjectStore('unprocessed');
                unprocessed.createIndex('received', 'timestamp', { unique: false });
                next();
            }
        },
        {
            version: "15.0",
            migrate: function(transaction, next) {
                console.log('migration 15.0');
                console.log('Adding messages index for de-duplication');
                var messages = transaction.objectStore('messages');
                messages.createIndex('unique', ['source', 'sourceDevice', 'sent_at'], { unique: true });
                next();
            }
        }
    ];
}());
