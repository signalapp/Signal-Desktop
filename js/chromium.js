/*global chrome*/
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
(function () {
    'use strict';
    // Browser specific functions for Chrom*
    window.extension = window.extension || {};

    window.extension.navigator = (function () {
        var self = {},
            tabs = {};
        tabs.create = function (url) {
            chrome.tabs.create({url: url});
        };
        self.tabs = tabs;

        self.setBadgeText = function (text) {
            chrome.browserAction.setBadgeText({text: String(text)});
        };

        return self;
    }());

    window.extension.trigger = function (name, object) {
        chrome.runtime.sendMessage(null, { name: name, data: object });
    };

    window.extension.on = function (name, callback) {
        // this causes every listener to fire on every message.
        // if we eventually end up with lots of listeners (lol)
        // might be worth making a map of 'name' -> [callbacks, ...]
        // so we can fire a single listener that calls only the necessary
        // calllbacks for that message name
        chrome.runtime.onMessage.addListener(function(e) {
            if (e.name === name) {
                callback(e.data);
            }
        });
    };

    extension.windows = {
        open: function(options, callback) {
            chrome.windows.create(options, callback);
        },

        focus: function(id, callback) {
            chrome.windows.update(id, { focused: true }, callback);
        },

        onClosed: function(callback) {
            chrome.windows.onRemoved.addListener(callback);
        },

        getCurrent: function(callback) {
            chrome.windows.getCurrent(callback);
        },

        remove: function(windowId) {
            chrome.windows.remove(windowId);
        },

        getBackground: function() {
            return chrome.extension.getBackgroundPage();
        }
    };

    extension.browserAction = function(callback) {
        chrome.browserAction.onClicked.addListener(callback);
    };

    window.textsecure = window.textsecure || {};
    window.textsecure.registration = {
        done: function () {
            localStorage.setItem("chromiumRegistrationDone", "");
            extension.trigger('registration_done');
            window.location = '/index.html';
        },

        isDone: function () {
            return localStorage.getItem("chromiumRegistrationDone") !== null;
        },
    };
}());
