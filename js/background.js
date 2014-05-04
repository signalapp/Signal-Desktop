/*
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

registerOnLoadFunction(function() {
	if (!localStorage.getItem('first_install_ran')) {
		localStorage.setItem('first_install_ran', 1);
		chrome.tabs.create({url: "options.html"});
	} else {
		if (isRegistrationDone()) {
			subscribeToPush(function(message) {
				console.log("Got message from " + message.pushMessage.source + "." + message.pushMessage.sourceDevice +
							': "' + getString(message.message.body) + '"');
				var newUnreadCount = storage.getUnencrypted("unreadCount", 0) + 1;
				storage.putUnencrypted("unreadCount", newUnreadCount);
				chrome.browserAction.setBadgeText({text: newUnreadCount + ""});
			});
		}
	}
});
