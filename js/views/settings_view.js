/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.SettingsView = Whisper.View.extend({
        className: 'settings modal',
        templateName: 'settings',
        events: {
            'change': 'change',
            'click .close': 'remove'
        },
        change: function(e) {
            var value = this.$(e.target).val();
            storage.put('notification-setting', value);
            console.log('notification setting changed to', value);
        },
        update: function() {
            var setting = storage.get('notification-setting');
            if (!setting) {
                setting = 'message';
            }
            this.$('#notification-setting-' + setting).attr('checked','checked');
            if (textsecure.storage.user.getDeviceId() != '1') {
                var syncView = new SyncView().render();
                this.$('.content').append(syncView.el);
            }
        },
        render_attributes: function() {
            return {
              notifications: i18n('notifications'),
              notificationSettingsDialog: i18n('notificationSettingsDialog'),
              settings: i18n('settings'),
              disableNotifications: i18n('disableNotifications'),
              nameAndMessage: i18n('nameAndMessage'),
              noNameOrMessage: i18n('noNameOrMessage'),
              nameOnly: i18n('nameOnly'),
            };
        }
    });

    var SyncView = Whisper.View.extend({
        templateName: 'syncSettings',
        className: 'syncSettings',
        events: {
            'click .sync': 'sync'
        },
        enable: function() {
            this.$('.sync').text(i18n('syncNow'));
            this.$('.sync').removeAttr('disabled');
        },
        disable: function() {
            this.$('.sync').attr('disabled', 'disabled');
            this.$('.sync').text(i18n('syncing'));
        },
        onsuccess: function() {
            storage.put('synced_at', Date.now());
            console.log('sync successful');
            this.enable();
            this.render();
        },
        ontimeout: function() {
            console.log('sync timed out');
            this.$('.synced_at').hide();
            this.$('.sync_failed').show();
            this.enable();
        },
        sync: function() {
            this.$('.sync_failed').hide();
            if (textsecure.storage.user.getDeviceId() != '1') {
                this.disable();
                var syncRequest = window.getSyncRequest();
                syncRequest.addEventListener('success', this.onsuccess.bind(this));
                syncRequest.addEventListener('timeout', this.ontimeout.bind(this));
            } else {
                console.log("Tried to sync from device 1");
            }
        },
        render_attributes: function() {
            var attrs = {
                sync: i18n('sync'),
                syncNow: i18n('syncNow'),
                syncExplanation: i18n('syncExplanation'),
                syncFailed: i18n('syncFailed')
            };
            var date = storage.get('synced_at');
            if (date) {
                date = new Date(date);
                attrs.lastSynced = i18n('lastSynced');
                attrs.syncDate = date.toLocaleDateString();
                attrs.syncTime = date.toLocaleTimeString();
            }
            return attrs;
        }
    });
})();
