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
                if (bg.textsecure.registration.everDone()) {
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
                        var launch = function() {
                            bg.openInbox();
                            bg.removeEventListener('textsecure:contactsync', launch);
                            window.close();
                        };
                        bg.addEventListener('textsecure:contactsync', launch);
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

    // Apply i18n
    $(document).ready(function(){
        // Basic Substitution
        $('[data-i18n]').each(function(){
            var $this = $(this);
            $this.text(i18n($this.data('i18n')));
        });

        // Text with link to Play Store
        var $installSignalLinkContent = $('<span>' + i18n('installSignalLink') + '</span>');
        $installSignalLinkContent.find('a').attr({
            class: 'link',
            href: 'https://play.google.com/store/apps/details?id=org.thoughtcrime.securesms',
            target: '_blank'
        });
        $('#installSignalLink').append($installSignalLinkContent);

        // Text with link to Twitter
        var $installFollowUsContent = $('<span>' + i18n('installFollowUs') + '</span>');
        $installFollowUsContent.find('a').attr({
            class: 'link',
            href: 'https://twitter.com/whispersystems',
            target: '_blank'
        });
        $('#installFollowUs').append($installFollowUsContent);
    });
})();
