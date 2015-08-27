/*global $, Whisper, Backbone, textsecure, extension*/
/* vim: ts=4:sw=4:expandtab:
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// This script should only be included in background.html
// Whisper.windowMap is defined in background.js
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    textsecure.protocol_wrapper.startWorker();

    var windowMap = new Whisper.Bimap('windowId', 'modelId');
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

    window.getConversationForWindow = function(windowId) {
        return conversations.get(windowMap.modelIdFrom(windowId));
    };

    window.updateConversation = function(conversationId) {
        var conversation = conversations.get(conversationId);
        if (conversation) {
            conversation.reload();
        }
    };

    function closeConversation (windowId) {
        windowMap.remove('windowId', windowId);
    }

    window.notifyConversation = function(message) {
        var conversationId = message.get('conversationId');
        var conversation = conversations.add({id: conversationId});
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
                        openInbox();
                    };
                });
            });
            conversation.fetchMessages();
        } else {
            openInbox();
            ConversationController.updateInbox();
        }
    };

    window.openConversation = function openConversation (modelId) {
        var conversation = conversations.add({id: modelId});
        conversation.reload();
        return conversation;
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
                    onWindowClosed(inboxWindowId);
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

    extension.onLaunched(function() {
        storage.onready(function() {
            if (textsecure.registration.isDone()) {
                openInbox();
            } else {
                extension.install();
            }
        });
    });

    // make sure windows are cleaned up on close
    var onWindowClosed = function (windowId) {
        if (windowMap.windowId[windowId]) {
            closeConversation(windowId);
        }

        if (windowId === inboxWindowId) {
            inboxWindowId = 0;
            inboxOpened = false;
        }
    };
})();
