/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    // Browser specific functions for Chrom*
    window.extension = window.extension || {};

    extension.windows = {
        onClosed: function(callback) {
            window.addEventListener('beforeunload', callback);
        }
    };

    extension.notification = {
        update: function(options) {
            var notification = new Notification(options.title, {
                body : options.message,
                icon : options.iconUrl,
                tag  : 'signal'
            });
            notification.onclick = function() {
                Whisper.Notifications.onclick();
            };
        }
    };

}());
