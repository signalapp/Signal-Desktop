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
            version: "1.0",
            migrate: function(transaction, next) {
                console.log('migration 1.0');
                var messages = transaction.db.createObjectStore("messages");
                messages.createIndex("conversation", ["conversationId", "received_at"], { unique: false });
                messages.createIndex("receipt", "sent_at", { unique: false });

                var conversations = transaction.db.createObjectStore("conversations");
                conversations.createIndex("inbox", "active_at", { unique: false });
                conversations.createIndex("group", "members", { unique: false, multiEntry: true });
                conversations.createIndex("type", "type", { unique: false });

                var groups = transaction.db.createObjectStore('groups');

                var sessions = transaction.db.createObjectStore('sessions');
                var identityKeys = transaction.db.createObjectStore('identityKeys');

                var preKeys = transaction.db.createObjectStore("preKeys");
                var signedPreKeys = transaction.db.createObjectStore("signedPreKeys");

                var items = transaction.db.createObjectStore("items");
                next();
            }
        },
        {
            version: "2.0",
            migrate: function(transaction, next) {
                var conversations = transaction.objectStore("conversations");
                conversations.createIndex("search", "tokens", { unique: false, multiEntry: true });

                var all = new Whisper.ConversationCollection();
                all.fetch().then(function() {
                    all.each(function(model) {
                        model.updateTokens();
                        model.save();
                    });
                });
            }
        },
        {
            version: "3.0",
            migrate: function(transaction, next) {
                var conversations = transaction.objectStore("items");

                var all = new Whisper.ConversationCollection();
                all.fetch().then(function() {
                    var unreadCount = all.reduce(function(total, model) {
                        var count = model.get('unreadCount');
                        if (count === undefined) {
                            count = 0;
                        }
                        return total + count;
                    }, 0);
                    storage.remove('unreadCount');
                    storage.put('unreadCount', unreadCount);
                });
            }
        },
        {
            version: "4.0",
            migrate: function(transaction, next) {
                var all = new Whisper.ConversationCollection();
                all.fetch().then(function() {
                    all.each(function(c) {
                        c.updateTokens();
                        c.save();
                    });
                });
            }
        }
    ];
}());
