/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    extension.windows.getBackground(function(bg) {
        bg.storage.onready(function() {
            $(function() {
                var Whisper = bg.Whisper;
                var installView = new Whisper.InstallView({
                      el: $('#install')
                });
                if (Whisper.Registration.everDone()) {
                    installView.selectStep(3);
                    installView.hideDots();
                }
                installView.$el.show();
                Whisper.events.on('contactsync:begin', installView.showSync, installView);
                Whisper.events.on('contactsync', function() {
                  installView.close();
                  bg.openInbox();
                  window.close();
                });
            });
        });
    });
})();
