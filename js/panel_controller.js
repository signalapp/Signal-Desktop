/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var conversations = new Whisper.ConversationCollection();

    window.inbox = new Whisper.ConversationCollection([], {
        comparator: function(model) {
            return -model.get('active_at');
        }
    });

    inbox.on('change:active_at', inbox.sort);
    inbox.on('change:unreadCount', function(model, count) {
        var prev = model.previous('unreadCount') || 0;
        if (count < prev) { // decreased
            var newUnreadCount = storage.get("unreadCount", 0) - (prev - count);
            setUnreadCount(newUnreadCount);
            storage.put("unreadCount", newUnreadCount);
        }
    });

    window.ConversationController = {
        get: function(id) {
            return conversations.get(id);
        },
        create: function(attrs) {
            var conversation = conversations.add(attrs);
            if (conversation.get('active_at')) {
                inbox.add(conversation);
            }
            return conversation;
        },
        findOrCreatePrivateById: function(id) {
            var conversation = conversations.add({ id: id, type: 'private' });
            return new Promise(function(resolve, reject) {
                conversation.fetch().then(function() {
                    resolve(conversation);
                }).fail(function() {
                    var saved = conversation.save(); // false or indexedDBRequest
                    if (saved) {
                        saved.then(function() {
                            resolve(conversation);
                        }).fail(reject);
                    }
                    reject();
                });
            });
        },
        updateInbox: function() {
            conversations.fetchActive().then(function() {
                inbox.reset(conversations.filter(function(model) {
                    return model.get('active_at');
                }));
            });
        }
    };

    window.updateInbox = function() { // TODO: remove
        ConversationController.updateInbox();
    };

    ConversationController.updateInbox();
    setUnreadCount(storage.get("unreadCount", 0));

    function setUnreadCount(count) {
        if (count > 0) {
            extension.navigator.setBadgeText(count);
        } else {
            extension.navigator.setBadgeText("");
        }
    }

    window.notifyConversation = function(message) {
        var conversationId = message.get('conversationId');
        var conversation = ConversationController.create({id: conversationId});
        if (inboxOpened) {
            conversation.reload();
            extension.windows.drawAttention(inboxWindowId);
        } else if (Whisper.Notifications.isEnabled()) {
            var sender = conversations.add({id: message.get('source')});
            conversation.fetch().then(function() {
                sender.fetch().then(function() {
                    var notification = new Notification(sender.getTitle(), {
                        body: message.getDescription(),
                        icon: sender.getAvatar().url,
                        tag: conversation.id
                    });
                    notification.onclick = function() {
                        openConversation(conversation);
                    };
                });
            });
            conversation.fetchMessages();
        } else {
            conversation.reload();
            openConversation(conversation);
            ConversationController.updateInbox();
        }
    };

    /* Inbox window controller */
    var inboxOpened = false;
    var inboxWindowId = 'inbox';
    window.openInbox = function() {
        if (inboxOpened === false) {
            inboxOpened = true;
            extension.windows.open({
                id: 'inbox',
                url: 'index.html',
                type: 'panel',
                frame: 'none',
                focused: true,
                width: 580,
                height: 440,
                minWidth: 230,
                minHeight: 150
            }, function (windowInfo) {
                inboxWindowId = windowInfo.id;

                windowInfo.onClosed.addListener(function () {
                    inboxWindowId = 0;
                    inboxOpened = false;
                });

                // close the panel if background.html is refreshed
                extension.windows.beforeUnload(function() {
                    // TODO: reattach after reload instead of closing.
                    extension.windows.remove(inboxWindowId);
                });
            });
        } else if (inboxOpened === true) {
            extension.windows.focus(inboxWindowId, function (error) {
                if (error) {
                    inboxOpened = false;
                    openInbox();
                }
            });
        }
    };

    var open;
    function openConversation(conversation) {
        if (inboxOpened === true) {
            var appWindow = chrome.app.window.get(inboxWindowId);
            appWindow.contentWindow.openConversation(conversation);
        } else {
            open = conversation;
            openInbox();
        }
    }
    window.getOpenConversation = function() {
        var o = open;
        open = null;
        return o;
    };

    extension.onLaunched(function() {
        storage.onready(function() {
            if (textsecure.registration.isDone()) {
                openInbox();
            } else {
                extension.install();
            }
        });
    });
})();
