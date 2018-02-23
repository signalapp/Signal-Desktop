/*
 * vim: ts=4:sw=4:expandtab
 */

;(function() {
    'use strict';
    window.Whisper = window.Whisper || {};

    var SETTINGS = {
        OFF     : 'off',
        COUNT   : 'count',
        NAME    : 'name',
        MESSAGE : 'message'
    };

    let isEnabled = false;
    var sound = new Audio('audio/NewMessage.mp3');

    Whisper.Notifications = new (Backbone.Collection.extend({
        initialize: function() {
            this.on('add', this.update);
            this.on('remove', this.onRemove);
        },
        onClick: function(conversationId) {
            var conversation = ConversationController.get(conversationId);
            this.trigger('click', conversation);
        },
        update: function() {
            const isFocused = window.isFocused();
            console.log(
                'updating notifications - count:', this.length,
                'focused:', isFocused,
                'isEnabled:', isEnabled
            );

            if (!isEnabled) {
                return;
            }
            if (this.length === 0) {
                return;
            }

            const isNotificationOmitted = isFocused;
            if (isNotificationOmitted) {
                this.clear();
                return;
            }

            var audioNotification = storage.get('audio-notification') || false;
            if (audioNotification) {
                sound.play();
            }

            var setting = storage.get('notification-setting') || 'message';
            if (setting === SETTINGS.OFF) {
                return;
            }

            window.drawAttention();

            var title;
            var message;
            var iconUrl;

            var newMessageCount = [
                this.length,
                this.length === 1 ? i18n('newMessage') : i18n('newMessages')
            ].join(' ');

            var last = this.last();
            switch (this.getSetting()) {
              case SETTINGS.COUNT:
                title = 'Signal';
                message = newMessageCount;
                break;
              case SETTINGS.NAME:
                title = newMessageCount;
                message = 'Most recent from ' + last.get('title');
                iconUrl = last.get('iconUrl');
                break;
              case SETTINGS.MESSAGE:
                if (this.length === 1) {
                  title = last.get('title');
                } else {
                  title = newMessageCount;
                }
                message = last.get('message');
                iconUrl = last.get('iconUrl');
                break;
            }

            if (window.config.polyfillNotifications) {
                window.nodeNotifier.notify({
                    title: title,
                    message: message,
                    sound: false
                });
                window.nodeNotifier.on('click', function(notifierObject, options) {
                    last.get('conversationId');
                });
            } else {
                var notification = new Notification(title, {
                    body   : message,
                    icon   : iconUrl,
                    tag    : 'signal',
                    silent : true
                });

                notification.onclick = this.onClick.bind(this, last.get('conversationId'));
            }

            // We don't want to notify the user about these same messages again
            this.clear();
        },
        getSetting: function() {
            return storage.get('notification-setting') || SETTINGS.MESSAGE;
        },
        onRemove: function() {
            console.log('remove notification');
        },
        clear: function() {
            console.log('remove all notifications');
            this.reset([]);
        },
        enable: function() {
            var shouldUpdate = !isEnabled;
            isEnabled = true;
            if (shouldUpdate) {
              this.update();
            }
        },
        disable: function() {
            isEnabled = false;
        },

    }))();
})();
