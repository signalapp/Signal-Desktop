/*global $, Whisper, Backbone, extension*/
/*
 * vim: ts=4:sw=4:expandtab
 */

// This script should only be included in background.html
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    window.isOpen = function() {
        return true;
    };

    window.drawAttention = function() {
        if (isOpen() && !isFocused()) {
            extension.windows.drawAttention(inboxWindowId);
        }
    };
    window.clearAttention = function() {
        extension.windows.clearAttention(inboxWindowId);
    };
    var inboxWindowId = 'inbox';

    window.openInbox = function() {
        Whisper.events.trigger('openInbox');
    };

    window.setUnreadCount = function(count) {
        if (count > 0) {
            extension.navigator.setBadgeText(count);
            window.document.title = "Signal (" + count + ")";
        } else {
            extension.navigator.setBadgeText("");
            window.document.title = "Signal";
        }
    };

    window.openConversation = function(conversation) {
        Whisper.events.trigger('openConversation', conversation);
    };

})();
