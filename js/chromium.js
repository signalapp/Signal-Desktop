/* vim: ts=4:sw=4
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

window.extension = window.extension || {};

window.extension.navigator = function() {
    var self = {};
    
    var tabs = {};
    tabs.create = function(url){
        chrome.tabs.create({url: url});
    };
    self.tabs = tabs;
    
    self.setBadgeText = function(text){
        chrome.browserAction.setBadgeText({text: text + ""});
    };
    
    return self;
}();

// Random shared utilities that are used only by chromium things

function registrationDone() {
	localStorage.setItem("chromiumRegistrationDone", "");
	//TODO: Fix dirty hack:
	chrome.runtime.reload();
}

function isRegistrationDone() {
	return localStorage.getItem("chromiumRegistrationDone") !== null;
}
