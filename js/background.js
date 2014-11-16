/* vim: ts=4:sw=4:expandtab
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

;(function() {
    'use strict';

    function init() {
        if (!localStorage.getItem('first_install_ran')) {
            localStorage.setItem('first_install_ran', 1);
            extension.navigator.tabs.create("options.html");
        } else {
            if (textsecure.registration.isDone()) {
                var conversations = new Whisper.ConversationCollection();
                textsecure.subscribeToPush(function(message) {
                    conversations.addIncomingMessage(message).then(function(message) {
                        extension.trigger('message', message);
                    });
                    console.log("Got message from " + message.pushMessage.source + "." + message.pushMessage.sourceDevice +
                                ': "' + getString(message.message.body) + '"');
                    var newUnreadCount = textsecure.storage.getUnencrypted("unreadCount", 0) + 1;
                    textsecure.storage.putUnencrypted("unreadCount", newUnreadCount);
                    extension.navigator.setBadgeText(newUnreadCount);
                });
            }
        }
    };

    textsecure.registration.addListener(init);
    init();
})();
