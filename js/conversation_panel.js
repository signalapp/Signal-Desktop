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
(function () {
  'use strict';

    window.Whisper = window.Whisper || {};

    function loadConversation (id) {
        var conversation = new Whisper.Conversation({ id: id });
        conversation.fetch().then(function () {
            new Whisper.ConversationView({ model: conversation}).render().$el.appendTo($('#conversation-container'));
        });
    };

    var windowId, windowMap = {};

    extension.trigger('log', 'loaded page');

    window.addEventListener('storage', function (e) {
        extension.trigger('log', 'got storage event');
        if (e.key = 'idPairs') {
            windowMap = JSON.parse(e.newValue);

            if (windowId) {
                var conversationId = windowMap[windowId];

                if (conversationId) {
                    loadConversation(conversationId);
                }
            }
        }
    });

    chrome.windows.getCurrent(function (windowInfo) {
        window.document.title = windowId = windowInfo.id;

        extension.trigger('log', 'got page id');

        var conversationId = windowMap[windowId];

        if (typeof conversationId !== 'undefined') {
            loadConversation(conversationId);
        }
    });
}());
