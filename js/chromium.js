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

    window.extension.onMessage = function (name, callback) {
        chrome.runtime.onMessage.addListener(function(e) {
            if (e.name === name) {
                callback(e.data);
            }
        });
    };

    window.textsecure = window.textsecure || {};
    window.textsecure.registration = {
        done: function () {
            localStorage.setItem("chromiumRegistrationDone", "");
            chrome.runtime.sendMessage('registration_done');
            window.location = '/index.html';
        },

        isDone: function () {
            return localStorage.getItem("chromiumRegistrationDone") !== null;
        },

        addListener: function (callback) {
            chrome.runtime.onMessage.addListener(function(message) {
                if (message === 'registration_done') {
                    callback();
                }
            });
        }
    };
}());
