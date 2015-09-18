/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    window.setUnreadCount = function(count) {
        if (count > 0) {
            extension.navigator.setBadgeText(count);
        } else {
            extension.navigator.setBadgeText("");
        }
    };

    window.notifyConversation = function(message) {
        var conversationId = message.get('conversationId');
        var conversation = ConversationController.get(conversationId);
        if (!conversation) {
            conversation = ConversationController.create({id: conversationId});
            conversation.fetch();
        }

        if (inboxOpened) {
            conversation.trigger('newmessages');
            extension.windows.drawAttention(inboxWindowId);
            if (!appWindow.isMinimized()) {
                return;
            }
        }

        if (Whisper.Notifications.isEnabled()) {
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
        }
    };

    /* Inbox window controller */
    var inboxOpened = false;
    var inboxWindowId = 'inbox';
    var appWindow = null;
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
                minWidth: 600,
                minHeight: 360
            }, function (windowInfo) {
                inboxWindowId = windowInfo.id;
                appWindow = windowInfo;

                windowInfo.onClosed.addListener(function () {
                    inboxOpened = false;
                    appWindow = null;
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
        }
        openInbox();
    };
    window.getOpenConversation = function() {
        var o = open;
        open = null;
        return o;
    };
})();
