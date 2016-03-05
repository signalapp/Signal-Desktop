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
        },
        render_attributes: function() {
            return {
              settings: i18n('settings'),
              disableNotifications: i18n('disableNotifications'),
              nameAndMessage: i18n('nameAndMessage'),
              noNameOrMessage: i18n('noNameOrMessage'),
              nameOnly: i18n('nameOnly'),
            };
        }
    });
})();
