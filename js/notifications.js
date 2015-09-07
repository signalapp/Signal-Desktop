/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.Notifications = {
      isEnabled: function(callback) {
        return Notification.permission === 'granted' &&
              !storage.get('disable-notifications');
      },
      enable: function(callback) {
        storage.remove('disable-notifications');
        Notification.requestPermission(function(status) {
            callback(status);
        });
      },
      disable: function() {
        storage.put('disable-notifications', true);
      }
    };

})();
