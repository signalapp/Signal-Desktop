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

    var enabled = false;

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
            console.log(
                'updating notifications - count:', this.length,
                'focused:', window.isFocused(),
                'enabled:', enabled
            );
            if (!enabled) {
                return; // wait til we are re-enabled
            }
            if (this.length === 0) {
                return;
            }
            if (window.isFocused()) {
                // The window is focused. Consider yourself notified.
                this.clear();
                return;
            }

            window.drawAttention();

            var audioNotification = storage.get('audio-notification') || false;

            var setting = storage.get('notification-setting') || 'message';
            if (setting === SETTINGS.OFF) {
                return;
            }

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
            var notification = new Notification(title, {
                body   : message,
                icon   : iconUrl,
                tag    : 'signal',
                silent : !audioNotification
            });

            notification.onclick = this.onClick.bind(this, last.get('conversationId'));

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
            var update = !enabled;
            enabled = true;
            if (update) {
              this.update();
            }
        },
        disable: function() {
            enabled = false;
        },

    }))();
})();
