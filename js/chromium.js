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
            if (chrome.tabs) {
                chrome.tabs.create({url: url});
            } else {
                extension.windows.open({url: url});
            }
        };
        self.tabs = tabs;

        self.setBadgeText = function (text) {
            if (chrome.browserAction && chrome.browserAction.setBadgeText) {
                chrome.browserAction.setBadgeText({text: String(text)});
            }
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
            if (chrome.windows) {
                chrome.windows.create(options, callback);
            } else if (chrome.app.window) {
                var url = options.url;
                delete options.url;
                chrome.app.window.create(url, options, callback);
            }
        },

        focus: function(id, callback) {
            if (chrome.windows) {
                chrome.windows.update(id, { focused: true }, function() {
                    callback(chrome.runtime.lastError);
                });
            } else if (chrome.app.window) {
                var appWindow = chrome.app.window.get(id);
                if (appWindow) {
                    appWindow.show();
                    appWindow.focus();
                    callback();
                } else {
                    callback('No window found for id ' + id);
                }
            }
        },

        getCurrent: function(callback) {
            if (chrome.windows) {
                chrome.windows.getCurrent(callback);
            } else if (chrome.app.window) {
                callback(chrome.app.window.current());
            }
        },

        remove: function(windowId) {
            if (chrome.windows) {
                chrome.windows.remove(windowId);
            } else if (chrome.app.window) {
                chrome.app.window.get(windowId).close();
            }
        },

        getBackground: function(callback) {
            var getBackground;
            if (chrome.extension) {
                var bg = chrome.extension.getBackgroundPage();
                bg.storage.onready(function() {
                    callback(bg);
                    resolve();
                });
            } else if (chrome.runtime) {
                chrome.runtime.getBackgroundPage(function(bg) {
                    bg.storage.onready(function() {
                        callback(bg);
                    });
                });
            }
        },

        getViews: function() {
            if (chrome.extension) {
                return chrome.extension.getViews();
            } else if (chrome.app.window) {
                return chrome.app.window.getAll().map(function(appWindow) {
                    return appWindow.contentWindow;
                });
            }
        },

        beforeUnload: function(callback) {
            if (chrome.runtime) {
                chrome.runtime.onSuspend.addListener(callback);
            } else {
                window.addEventListener('beforeunload', callback);
            }
        },

        drawAttention: function(window_id) {
            if (chrome.app.window) {
                var w = chrome.app.window.get(window_id);
                w.clearAttention();
                w.drawAttention();
            }
        }

    };

    extension.onLaunched = function(callback) {
        if (chrome.browserAction && chrome.browserAction.onClicked) {
            chrome.browserAction.onClicked.addListener(callback);
        }
        if (chrome.app && chrome.app.runtime) {
            chrome.app.runtime.onLaunched.addListener(callback);
        }
    };

    window.textsecure = window.textsecure || {};
    window.textsecure.registration = {
        done: function () {
            storage.put("chromiumRegistrationDone", "");
            extension.trigger('registration_done');
        },

        isDone: function () {
            return storage.get("chromiumRegistrationDone") === "";
        },
    };

    extension.install = function(mode) {
        var id = 'installer';
        var url = 'options.html';
        if (mode === 'standalone') {
            id = 'standalone-installer';
            url = 'register.html';
        }
        extension.windows.open({
            id: id,
            url: url,
            bounds: { width: 800, height: 666 }
        });
    };

    if (chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener(function(options) {
            if (options.reason === 'install') {
                extension.install();
            }
        });
    }
}());
