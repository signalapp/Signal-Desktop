/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    extension.windows.getBackground(function(bg) {
        bg.storage.onready(function() {
            $(function() {
                var deviceName = bg.textsecure.storage.user.getDeviceName();
                if (!deviceName) {
                    deviceName = 'Chrome';
                    if (navigator.userAgent.match('Mac OS')) {
                        deviceName += ' on Mac';
                    } else if (navigator.userAgent.match('Linux')) {
                        deviceName += ' on Linux';
                    } else if (navigator.userAgent.match('Windows')) {
                        deviceName += ' on Windows';
                    }
                }
                var view = new Whisper.InstallView({
                    el: $('#install'),
                    deviceName: deviceName
                });
                if (bg.textsecure.registration.isDone()) {
                    view.selectStep(3);
                }
                view.$el.show();
                var accountManager = new bg.getAccountManager();

                var init = function() {
                    view.clearQR();

                    accountManager.registerSecondDevice(
                        view.setProvisioningUrl.bind(view),
                        view.confirmNumber.bind(view),
                        view.incrementCounter.bind(view)
                    ).then(function() {

                        // helper function to make time-outing promises that
                        // wait for event and then "clean" after themselves
                        function timeoutListenerPromise(event) {
                            return new Promise(function(resolve) {
                                var timeout;
                                var listener = function() {
                                    clearTimeout(timeout);
                                    resolve();
                                }
                                timeout = setTimeout(function() {
                                    bg.removeEventListener(event, listener);
                                    resolve();
                                }, 60000);
                                bg.addEventListener(event, listener);
                            });
                        }

                        var contactSyncPromise = timeoutListenerPromise('textsecure:contactsync');
                        var groupSyncPromise = timeoutListenerPromise('textsecure:groupsync');

                        var launch = function() {
                            bg.openInbox();
                            window.close();
                        };

                        Promise.all([contactSyncPromise, groupSyncPromise]).then(function() {
                            launch();
                        });

                        view.showSync();
                    }).catch(function(e) {
                        if (e.message === 'websocket closed') {
                            init();
                        } else if (e.name === 'HTTPError' && e.code == 411) {
                            view.showTooManyDevices();
                        }
                        else {
                            throw e;
                        }
                    });
                };
                $('.error-dialog .ok').click(init);
                init();
            });
        });
    });
})();
