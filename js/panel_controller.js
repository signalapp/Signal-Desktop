/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    var conversations = new Whisper.ConversationCollection();
    var inboxCollection = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('change:active_at', this.sort);
            this.on('change:unreadCount', this.updateUnreadCount);

            this.listenTo(conversations, 'add change:active_at', this.addActive);
        },
        comparator: function(model) {
            return -model.get('active_at');
        },
        addActive: function(model) {
            if (model.get('active_at')) {
                this.add(model);
            }
        },
        updateUnreadCount: function(model, count) {
            var prev = model.previous('unreadCount') || 0;
            if (count < prev) { // decreased
                var newUnreadCount = storage.get("unreadCount", 0) - (prev - count);
                setUnreadCount(newUnreadCount);
                storage.put("unreadCount", newUnreadCount);
            }
        }
    }))();

    window.getInboxCollection = function() {
        return inboxCollection;
    };

    window.ConversationController = {
        get: function(id) {
            return conversations.get(id);
        },
        create: function(attrs) {
            var conversation = conversations.add(attrs);
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
            conversations.fetchActive();
        }
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
        var conversation = ConversationController.get(conversationId);
        if (!conversation) {
            conversation = conversations.create({id: conversationId});
            conversation.fetch();
        }
        if (inboxOpened) {
            conversation.trigger('newmessages');
            extension.windows.drawAttention(inboxWindowId);
        } else if (Whisper.Notifications.isEnabled()) {
            var sender = ConversationController.create({id: message.get('source')});
            conversation.fetch().then(function() {
                sender.fetch().then(function() {
                    sender.getNotificationIcon().then(function(iconUrl) {
                        Whisper.Notifications.add({
                            title    : sender.getTitle(),
                            message  : message.getNotificationText(),
                            iconUrl  : iconUrl,
                            imageUrl : message.getImageUrl(),
                            conversationId: conversation.id
                        });
                    });
                });
            });
        } else {
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
    window.openConversation = function(conversation) {
        if (inboxOpened === true) {
            var appWindow = chrome.app.window.get(inboxWindowId);
            appWindow.contentWindow.openConversation(conversation);
        } else {
            open = conversation;
            openInbox();
        }
    };
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
