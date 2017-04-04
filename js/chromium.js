/*
 * vim: ts=4:sw=4:expandtab
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
            if (window.chrome && chrome.browserAction && chrome.browserAction.setBadgeText) {
                chrome.browserAction.setBadgeText({text: String(text)});
            }
        };

        return self;
    }());

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
            if (window.chrome && chrome.windows) {
                chrome.windows.update(id, { focused: true }, function() {
                    callback(chrome.runtime.lastError);
                });
            } else if (window.chrome && chrome.app.window) {
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
            if (window.chrome && chrome.extension) {
                var bg = chrome.extension.getBackgroundPage();
                bg.storage.onready(function() {
                    callback(bg);
                    resolve();
                });
            } else if (window.chrome && chrome.runtime) {
                chrome.runtime.getBackgroundPage(function(bg) {
                    bg.storage.onready(function() {
                        callback(bg);
                    });
                });
            }
        },

        getAll: function() {
                  if (window.chrome) {
                    return chrome.app.window.getAll();
                  } else {
                    return [];
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
            if (chrome.runtime) {
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
            if (window.chrome && chrome.app.window) {
                var w = chrome.app.window.get(window_id);
                if (w) {
                    w.clearAttention();
                    w.drawAttention();
                }
            }
        },

        clearAttention: function(window_id) {
            if (window.chrome && chrome.app.window) {
                var w = chrome.app.window.get(window_id);
                if (w) {
                    w.clearAttention();
                }
            }
        }

    };

    extension.onLaunched = function(callback) {
        if (window.chrome && chrome.browserAction && chrome.browserAction.onClicked) {
            chrome.browserAction.onClicked.addListener(callback);
        }
        if (window.chrome && chrome.app && chrome.app.runtime) {
            chrome.app.runtime.onLaunched.addListener(callback);
        }
    };

    // Translate

    if (window.chrome && window.chrome.i18n) {
      window.i18n = function(message, substitutions) {
          return chrome.i18n.getMessage(message, substitutions);
      };

      i18n.getLocale = function() {
          if (window.chrome && chrome.i18n) {
              return chrome.i18n.getUILanguage();
          }
          return 'en';
      };
    }

    extension.install = function(mode) {
        if (mode === 'standalone') {
            return; // TODO
        }
        var installView = new Whisper.InstallView({
              el: $('body').empty()
        });
        if (Whisper.Registration.everDone()) {
            installView.selectStep(3);
            installView.hideDots();
        }
        installView.$el.show();
        Whisper.events.once('contactsync', function() {
            openInbox();
            installView.remove();
        });
    };

    var notification_pending = Promise.resolve();
    extension.notification = {
        init: function() {
            // register some chrome listeners
            if (window.chrome && chrome.notifications) {
                chrome.notifications.onClicked.addListener(function() {
                    extension.notification.clear();
                    Whisper.Notifications.onclick();
                });
                chrome.notifications.onButtonClicked.addListener(function() {
                    extension.notification.clear();
                    Whisper.Notifications.clear();
                    getInboxCollection().each(function(model) {
                        model.markRead();
                    });
                });
                chrome.notifications.onClosed.addListener(function(id, byUser) {
                    if (byUser) {
                        Whisper.Notifications.clear();
                    }
                });
            }
        },
        clear: function() {
            notification_pending = notification_pending.then(function() {
                return new Promise(function(resolve) {
                    if (window.chrome) {
                      chrome.notifications.clear('signal',  resolve);
                    }
                });
            });
        },
        update: function(options) {
            if (window.chrome) {
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
        if (window.chrome && chrome && chrome.alarms) {
            chrome.alarms.onAlarm.addListener(function() {
                // nothing to do.
            });
            chrome.alarms.create('awake', {periodInMinutes: 1});
        }
    };

    if (window.chrome && chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener(function(options) {
            if (options.reason === 'install') {
                console.log('new install');
                extension.install();
            } else if (options.reason === 'update') {
                console.log('new update. previous version:', options.previousVersion);
            } else {
                console.log('onInstalled', options.reason);
            }
        });
    }
}());
