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

  var windowMap = Whisper.windowMap;

  window.openConversation = function openConversation (modelId) {

    var windowId = windowMap.windowIdFrom(modelId);

    // prevent multiple copies of the same conversation from being opened
    if (!windowId) {
      // open the panel
      chrome.windows.create({
        url: 'conversation.html',
        type: 'panel',
        focused: true,
        width: 280,
        height: 420
      }, function (windowInfo) {
        var idPairs = JSON.parse(localStorage.getItem('idPairs'));
        var newWindowId = windowInfo.id;

        windowMap.add({
          windowId: windowInfo.id,
          modelId: modelId
        });
      });
    } else {
      // focus the panel
      chrome.windows.update(windowId, { focused: true }, function () {
        if (chrome.runtime.lastError) {
          // panel isn't actually open...
          window.closeConversation(windowId);

          // ...and so we try again.
          openConversation(modelId);
        }
      });
    }
  };

  window.closeConversation = function closeConversation (windowId) {
    windowMap.remove('windowId', windowId);
  };
})();
