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

  // TODO: RJS
  // resetting for now, but super fragile:
  //   1. if this file is included in conversation.html we're doomed.
  //   2. if index.html is refreshed, duplicates can be opened
  //   2.5. ...and refreshing conversation windows will fuck up.
  if (!localStorage.getItem('activeConversations')) {
    localStorage.setItem('activeConversations', '{}');
  }

  if (!localStorage.getItem('idPairs')) {
    localStorage.setItem('idPairs', '{}');
  }

  // TODO: RJS
  // How do we normally export from modules like this?
  // Is it necessary to have n copies of each of these scripts..?
  //   (n Whisper objects, etc in existence) Using localStorage for
  //   sync feels like a hack...
  //
  window.openConversation = function openConversation (modelId) {
    var activeConversations = JSON.parse(localStorage.getItem('activeConversations'));
    var windowId = activeConversations[modelId];

    // prevent multiple copies of the same conversation from being opened
    if (!windowId) {
      localStorage.setItem('activeConversations', JSON.stringify(activeConversations));

      // open the window
      chrome.windows.create({
        url: 'conversation.html',
        type: 'panel',
        focused: true,
        width: 280,
        height: 420
      }, function (windowInfo) {
        var idPairs = JSON.parse(localStorage.getItem('idPairs'));
        var newWindowId = windowInfo.id;

        // TODO: RJS
        // should we make a class for bijection?
        // bit sketchy that we have to keep these two hashes synced...
        activeConversations[modelId] = newWindowId;
        idPairs[newWindowId] = modelId;

        localStorage.setItem('activeConversations', JSON.stringify(activeConversations));
        localStorage.setItem('idPairs', JSON.stringify(idPairs));
      });
    } else {
      try {
        chrome.windows.update(windowId, { focused: true }, function () {
            if (chrome.runtime.lastError) {
                window.closeConversation(windowId);
            } else {
                // Tab exists
            }
        });
      } catch (err) {
        // TODO: RJS
        //  - should check the err type
        //  - should open a new panel here
      }
    }
  };

  window.closeConversation = function closeConversation (windowId) {
    var activeConversations = JSON.parse(localStorage.getItem('activeConversations'));
    var idPairs = JSON.parse(localStorage.getItem('idPairs'));

    delete activeConversations[idPairs[windowId]];
    delete idPairs[windowId];

    localStorage.setItem('activeConversations', JSON.stringify(activeConversations));
    localStorage.setItem('idPairs', JSON.stringify(idPairs));
  };
}());
