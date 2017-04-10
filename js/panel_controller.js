/*global $, Whisper, Backbone, textsecure, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};


    window.isFocused = function() {
        return inboxFocused;
    };
    window.isOpen = function() {
        return inboxOpened;
    };

    window.drawAttention = function() {
        if (inboxOpened && !inboxFocused) {
            extension.windows.drawAttention(inboxWindowId);
        }
    };
    window.clearAttention = function() {
        extension.windows.clearAttention(inboxWindowId);
    };

    /* Inbox window controller */
    var inboxFocused = false;
    var inboxOpened = false;
    var inboxWindowId = 'inbox';
    var appWindow = null;
    window.openInbox = function() {
        console.log('open inbox');
        if (inboxOpened === false) {
            inboxOpened = true;
            extension.windows.open({
                id: 'inbox',
                url: 'index.html',
                focused: true,
                width: 580,
                height: 440,
                minWidth: 600,
                minHeight: 360
            }, function (windowInfo) {
                appWindow = windowInfo;
                inboxWindowId = appWindow.id;

                appWindow.contentWindow.addEventListener('load', function() {
                    setUnreadCount(storage.get("unreadCount", 0));
                });

                appWindow.onClosed.addListener(function () {
                    inboxOpened = false;
                    appWindow = null;
                });

                appWindow.contentWindow.addEventListener('blur', function() {
                    inboxFocused = false;
                });
                appWindow.contentWindow.addEventListener('focus', function() {
                    inboxFocused = true;
                    clearAttention();
                });

                // close the inbox if background.html is refreshed
                extension.windows.onSuspend(function() {
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

    window.setUnreadCount = function(count) {
        if (count > 0) {
            extension.navigator.setBadgeText(count);
            if (inboxOpened === true && appWindow) {
                appWindow.contentWindow.document.title = "Signal (" + count + ")";
            }
        } else {
            extension.navigator.setBadgeText("");
            if (inboxOpened === true && appWindow) {
                appWindow.contentWindow.document.title = "Signal";
            }
        }
    };

    var open;
    window.openConversation = function(conversation) {
        if (inboxOpened === true) {
            owsDesktopApp.openConversation(conversation);
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
