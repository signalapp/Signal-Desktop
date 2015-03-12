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
    var bg = extension.windows.getBackground();

    window.Whisper = window.Whisper || {};
    if (bg.textsecure.storage.getUnencrypted("number_id") === undefined) {
        extension.navigator.tabs.create('/options.html');
        window.close();
    } else {
        new bg.Whisper.InboxView().$el.prependTo(bg.$('body',document));
        bg.textsecure.storage.putUnencrypted("unreadCount", 0);
        extension.navigator.setBadgeText("");

        window.addEventListener('beforeunload', function () {
            chrome.browserAction.setPopup({popup: 'index.html'}); // pop in
        });

        extension.windows.getCurrent(function (windowInfo) {
            if (windowInfo.type === 'normal') {
                bg.$('body', document).addClass('pop-in');
            } else {
                bg.$('.popout', document).remove();
            }
        });
    }
}());
