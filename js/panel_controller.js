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

    var windowMap = new Whisper.Bimap('windowId', 'modelId');
    var conversations = new Whisper.ConversationCollection();

    window.getConversationForWindow = function(windowId) {
        return conversations.get(windowMap.modelIdFrom(windowId));
    };

    window.updateConversation = function(conversationId) {
        var conversation = conversations.get(conversationId);
        if (conversation) {
            conversation.fetch();
            conversation.fetchMessages();
        }
    };

    function closeConversation (windowId) {
        windowMap.remove('windowId', windowId);
    }

    window.openConversation = function openConversation (modelId) {
        var conversation = window.inbox.get(modelId) || {id: modelId};
        conversation = conversations.add(conversation);
        conversation.fetch().then(function() {
            conversation.fetchContacts();
        });
        conversation.fetchMessages();

        var windowId = windowMap.windowIdFrom(modelId);

        // prevent multiple copies of the same conversation from being opened
        if (!windowId) {
            // open the panel
            extension.windows.open({
                url: 'conversation.html',
                type: 'panel',
                focused: true,
                width: 300,
                height: 420
            }, function (windowInfo) {
                windowMap.add({ windowId: windowInfo.id, modelId: modelId });

                // close the panel if background.html is refreshed
                window.addEventListener('beforeunload', function () {
                    // TODO: reattach after reload instead of closing.
                    extension.windows.remove(windowInfo.id);
                });
            });
        } else {
            // focus the panel
            extension.windows.focus(windowId, function () {
                if (chrome.runtime.lastError) {
                    closeConversation(windowId); // panel isn't actually open...
                    openConversation(modelId); // ...and so we try again.
                }
            });
        }
    };

    /* Inbox window controller */
    var inboxOpened = false;
    var inboxWindowId = 0;
    window.openInbox = function() {
        if (inboxOpened === false) {
            inboxOpened = true;
            extension.windows.open({
                url: 'index.html',
                type: 'panel',
                focused: true,
                width: 260, // 280 for chat
                height: 440 // 420 for chat
            }, function (windowInfo) {
                inboxWindowId = windowInfo.id;
            });
        } else if (inboxOpened === true) {
            extension.windows.focus(inboxWindowId);
        }
    };

    // make sure windows are cleaned up on close
    extension.windows.onClosed(function (windowId) {
        if (windowMap.windowId[windowId]) {
            closeConversation(windowId);
        }

        if (windowId === inboxWindowId) {
            inboxWindowId = 0;
            inboxOpened = false;
        }
    });
})();
