/*
 * vim: ts=4:sw=4:expandtab
 */
var windowscope = this;

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
            if (typeof chrome != 'undefined' && chrome.browserAction && chrome.browserAction.setBadgeText) {
                chrome.browserAction.setBadgeText({text: String(text)});
            } else {
              document.title = text;
            }
        };

        return self;
    }());

    window.extension.messageListeners = [];

    window.extension.trigger = function (name, object) {
      if (typeof chrome != 'undefined') {
        chrome.runtime.sendMessage(null, { name: name, data: object });
      } else {
        // fallback
        for (var listener of window.extension.messageListeners) {
          listener({ name: name, data: object });
        }
      }
    };

    window.extension.on = function (name, callback) {
        // this causes every listener to fire on every message.
        // if we eventually end up with lots of listeners (lol)
        // might be worth making a map of 'name' -> [callbacks, ...]
        // so we can fire a single listener that calls only the necessary
        // calllbacks for that message name
        if (typeof chrome != 'undefined') {
          chrome.runtime.onMessage.addListener(function(e) {
            if (e.name === name) {
                callback(e.data);
            }
          });
        } else {
          // fallback
          window.extension.messageListeners.push(function(e) {
            if (e.name === name) {
                callback(e.data);
            }
          });
        }
    };

    extension.windows = {
        open: function(options, callback) {
          if (typeof chrome != 'undefined') {
            if (chrome.windows) {
                chrome.windows.create(options, callback);
            } else if (chrome.app.window) {
                var url = options.url;
                delete options.url;
                chrome.app.window.create(url, options, callback);
            }
          } else {
            // TODO: fallback
            console.log("TODO: windows.open", options, callback);

            callback({
              id: url,
              contentWindow: window,
              onClosed: {
                addListener: function(callback){
                  console.log("TODO: store callback (appWindow.onClosed.addListener)");
                }
              },

            });

          }
        },

        focus: function(id, callback) {
          if (typeof chrome != 'undefined') {
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
          } else {
            // TODO: fallback
            console.log("TODO: fallback (windows.focus)");
          }
        },

        getCurrent: function(callback) {
          if (typeof chrome != 'undefined') {
            if (chrome.windows) {
                chrome.windows.getCurrent(callback);
            } else if (chrome.app.window) {
                callback(chrome.app.window.current());
            }
          } else  {
            // TODO: is the following object complete?

            callback({
              textsecure: textsecure,
              storage: window.storage,
              getAccountManager: window.getAccountManager,
              openInbox: window.openInbox,
              contentWindow: window
            });
          }
        },

        remove: function(windowId) {
            if (typeof chrome != 'undefined') {
                if (chrome.windows) {
                    chrome.windows.remove(windowId);
                } else if (chrome.app.window) {
                    chrome.app.window.get(windowId).close();
                }
            } else {
              // TODO: fallback
              console.log("TODO: fallback (windows.remove)");
            }
        },

        getBackground: function(callback) {
            var getBackground;
            if (typeof chrome != 'undefined') {
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
            } else {
              // fallback
              console.log(window);
              callback(window);
              //callback(windowscope);
              /*callback({
                textsecure: textsecure,
                storage: window.storage,
                getAccountManager: window.getAccountManager,
                openInbox: window.openInbox
              });*/
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

        onSuspend: function(callback) {
            if (typeof chrome != 'undefined' && chrome.runtime) {
                chrome.runtime.onSuspend.addListener(callback);
            } else {
                window.addEventListener('beforeunload', callback);
            }
        },
        onClosed: function(callback) {
            // assumes only one front end window
            if (window.chrome && chrome.app && chrome.app.window) {
                return chrome.app.window.getAll()[0].onClosed.addListener(callback);
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
        },

        clearAttention: function(window_id) {
            if (typeof chrome != 'undefined' && chrome.app.window) {
                var w = chrome.app.window.get(window_id);
                w.clearAttention();
            } else {
                // TODO: fallback
                // is there something like this in Firefox?
                console.log("TODO: fallback (clearAttention)");
            }
        }

    };

    extension.onLaunched = function(callback) {
      if (typeof chrome != 'undefined') {
        if (chrome.browserAction && chrome.browserAction.onClicked) {
            chrome.browserAction.onClicked.addListener(callback);
        }
        if (chrome.app && chrome.app.runtime) {
            chrome.app.runtime.onLaunched.addListener(callback);
        }
      } else {
        document.addEventListener('DOMContentLoaded', function() {
            callback();
        }, false);
      }
    };

    // Translate
    window.i18n = function(message) {
        if (typeof chrome != 'undefined') {
          return chrome.i18n.getMessage(message);
        } else {
          var i18nString = "missing translation";
          $.ajax({
            url: "_locales/en/messages.json",
            success: function(data) {
              i18nString = data[message].message;
            },
            async: false,
            dataType: "json"
          });
          return i18nString;
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
        if (typeof chrome != 'undefined') {
          if (!chrome.app.window.get(id)) {
              extension.windows.open({
                  id: id,
                  url: url,
                  bounds: { width: 800, height: 666, },
                  minWidth: 800,
                  minHeight: 666
              });
          }
        } else {
          extension.windows.open({
              id: id,
              url: url,
              bounds: { width: 800, height: 666, },
              minWidth: 800,
              minHeight: 666
          });
        }
    };

    var notification_pending = Promise.resolve();
    extension.notification = {
        clear: function() {
            notification_pending = notification_pending.then(function() {
                return new Promise(function(resolve) {
                    chrome.notifications.clear('signal',  resolve);
                });
            });
        },
        update: function(options) {
            if (chrome) {
                var chromeOpts = {
                    type     : options.type,
                    title    : options.title,
                    message  : options.message || '', // required
                    iconUrl  : options.iconUrl,
                    imageUrl : options.imageUrl,
                    items    : options.items,
                    buttons  : options.buttons
                };
                notification_pending = notification_pending.then(function() {
                    return new Promise(function(resolve) {
                        chrome.notifications.update('signal', chromeOpts, function(wasUpdated) {
                            if (!wasUpdated) {
                                chrome.notifications.create('signal', chromeOpts, resolve);
                            } else {
                                resolve();
                            }
                        });
                    });
                });
            } else {
                var notification = new Notification(options.title, {
                    body : options.message,
                    icon : options.iconUrl,
                    tag  : 'signal'
                });
                notification.onclick = function() {
                    Whisper.Notifications.onclick();
                };
            }
        }
    };

    extension.keepAwake = function() {
        if (typeof chrome != 'undefined' && chrome && chrome.alarms) {
            chrome.alarms.onAlarm.addListener(function() {
                // nothing to do.
            });
            chrome.alarms.create('awake', {periodInMinutes: 1});
        } else {
          // TODO: fallback
          console.log("TODO: fallback (keepAwake)");
        }
    };

    if (typeof chrome != 'undefined') {
      if (chrome.runtime.onInstalled) {
          chrome.runtime.onInstalled.addListener(function(options) {
              if (options.reason === 'install') {
                  extension.install();
              }
          });
      }
    } else {
      // TODO: fallback
      console.log("TODO: fallback (install)");
    }
}());
