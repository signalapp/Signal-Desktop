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
                console.log('creating object stores');
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
                console.log('migration 2.0');
                var conversations = transaction.objectStore("conversations");
                conversations.createIndex("search", "tokens", { unique: false, multiEntry: true });

                window.addEventListener('storage_ready', function() {
                    console.log('migrating search tokens');
                    var all = new Whisper.ConversationCollection();
                    all.fetch().then(function() {
                        all.each(function(model) {
                            model.updateTokens();
                            model.save();
                        });
                    });
                });
                next();
            }
        },
        {
            version: "3.0",
            migrate: function(transaction, next) {
                console.log('migration 3.0');
                var conversations = transaction.objectStore("items");

                window.addEventListener('storage_ready', function() {
                    console.log('migrating unread count');
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
                });
                next();
            }
        },
        {
            version: "4.0",
            migrate: function(transaction, next) {
                console.log('migration 4.0');
                window.addEventListener('storage_ready', function() {
                    console.log('migrating search tokens');
                    var all = new Whisper.ConversationCollection();
                    all.fetch().then(function() {
                        all.each(function(c) {
                            c.updateTokens();
                            c.save();
                        });
                    });
                });
                next();
            }
        },
        {
            version: "5.0",
            migrate: function(transaction, next) {
                console.log('migration 5.0');
                window.addEventListener('storage_ready', function() {
                    console.log('migrating registration flags');
                    if (storage.get("chromiumRegistrationDone") === "") {
                        storage.put("chromiumRegistrationDoneEver", "");
                    }
                });
                next();
            }
        },
        {
            version: "6.0",
            migrate: function(transaction, next) {
                console.log('migration 6.0');
                window.addEventListener('storage_ready', function() {
                    console.log('migrating registration flags');
                    storage.onready(function() {
                        if (storage.get("chromiumRegistrationDone") === "") {
                            storage.put("chromiumRegistrationDoneEver", "");
                            next();
                        }
                    });
                });
                next();
            }
        },
        {
            version: "7.0",
            migrate: function(transaction, next) {
                console.log('migration 7.0');
                console.log('creating debug log');
                transaction.db.createObjectStore("debug");
                next();
            }
        },
        {
            version: "8.0",
            migrate: function(transaction, next) {
                console.log('migration 8.0');
                console.log('creating unread message index');
                var conversations = transaction.objectStore('messages');
                conversations.createIndex('unread', ['conversationId', 'unread'], { unique: false });
                next();
            }
        },
        {
            version: "9.0",
            migrate: function(transaction, next) {
                console.log('migration 9.0');
                window.addEventListener('storage_ready', function() {
                    console.log('marking contacts and groups active');
                    var all = new Whisper.ConversationCollection();
                    var myNumber = textsecure.storage.user.getNumber();
                    all.fetch().then(function() {
                        var inactive = all.filter(function(model) {
                            return !model.get('active_at') && model.id !== myNumber;
                        });
                        inactive.sort(function(m1, m2) {
                            var title1 = m1.getTitle().toLowerCase();
                            var title2 = m2.getTitle().toLowerCase();
                            if (title1 ===  title2) {
                                return 0;
                            }
                            if (title1 < title2) {
                                return -1;
                            }
                            if (title1 > title2) {
                                return 1;
                            }
                        });
                        inactive.forEach(function(model) {
                            if (model.isPrivate() || !model.get('left')) {
                                model.save({ active_at: 1 });
                            }
                        });
                    });
                });
                next();
            }
        },
        {
            version: "10.0",
            migrate: function(transaction, next) {
                console.log('migration 10.0');
                console.log('creating expiring message index');
                var messages = transaction.objectStore('messages');
                messages.createIndex('expire', 'expireTimer', { unique: false });
                next();
            }
        },
        {
            version: "11.0",
            migrate: function(transaction, next) {
                console.log('migration 11.0');
                console.log('creating expires_at message index');
                var messages = transaction.objectStore('messages');
                messages.createIndex('expires_at', 'expires_at', { unique: false });
                next();
            }
        },
        {
            version: "12.0",
            migrate: function(transaction, next) {
                console.log('migration 12.0');
                console.log('cleaning up expiring messages with no expires_at');
                window.addEventListener('storage_ready', function() {
                    var messages = new Whisper.MessageCollection();
                    messages.fetch({
                      conditions: {expireTimer: {$gt: 0}},
                      addIndividually: true
                    });
                    messages.on('add', function(m) {
                      messages.remove(m);
                    });
                });
                next();
            }
        }
    ];
}());
