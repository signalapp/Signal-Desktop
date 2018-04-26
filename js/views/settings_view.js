/* global storage: false */
/* global textsecure: false */
/* global i18n: false */
/* global Whisper: false */

/* eslint-disable */

(function () {
    'use strict';
    window.Whisper = window.Whisper || {};
    const { Database } = window.Whisper;
    const { OS, Logs } = window.Signal;
    const { Settings } = window.Signal.Types;

    var CheckboxView = Whisper.View.extend({
        initialize: function(options) {
            this.name = options.name;
            this.defaultValue = options.defaultValue;
            this.event = options.event;
            this.populate();
        },
        events: {
            'change': 'change'
        },
        change: function(e) {
            var value = e.target.checked;
            storage.put(this.name, value);
            console.log(this.name, 'changed to', value);
            if (this.event) {
                this.$el.trigger(this.event);
            }
        },
        populate: function() {
            var value = storage.get(this.name, this.defaultValue);
            this.$('input').prop('checked', !!value);
        },
    });
    var RadioButtonGroupView = Whisper.View.extend({
        initialize: function(options) {
            this.name = options.name;
            this.defaultValue = options.defaultValue;
            this.event = options.event;
            this.populate();
        },
        events: {
            'change': 'change'
        },
        change: function(e) {
            var value = this.$(e.target).val();
            storage.put(this.name, value);
            console.log(this.name, 'changed to', value);
            if (this.event) {
                this.$el.trigger(this.event);
            }
        },
        populate: function() {
            var value = storage.get(this.name, this.defaultValue);
            this.$('#' + this.name + '-' + value).attr('checked', 'checked');
        },
    });
    Whisper.SettingsView = Whisper.View.extend({
        className: 'settings modal expand',
        templateName: 'settings',
        initialize: function() {
            this.deviceName = textsecure.storage.user.getDeviceName();
            this.render();
            new RadioButtonGroupView({
                el: this.$('.notification-settings'),
                defaultValue: 'message',
                name: 'notification-setting'
            });
            new RadioButtonGroupView({
                el: this.$('.theme-settings'),
                defaultValue: 'android',
                name: 'theme-setting',
                event: 'change-theme'
            });
            if (Settings.isAudioNotificationSupported()) {
                new CheckboxView({
                    el: this.$('.audio-notification-setting'),
                    defaultValue: false,
                    name: 'audio-notification'
                });
            }
            if (OS.isMac()) {
                new CheckboxView({
                    el: this.$('.mac-dockBounce-notification-setting'),
                    defaultValue: false,
                    name: 'mac-dockBounce-notification'
                })
            }
            if (OS.isWindows()) {
                new CheckboxView({
                    el: this.$('.windows-flashFrame-notification-setting'),
                    defaultValue: false,
                    name: 'windows-flashFrame-notification'
                })
            }
            new CheckboxView({
                el: this.$('.menu-bar-setting'),
                defaultValue: false,
                name: 'hide-menu-bar',
                event: 'change-hide-menu'
            });
            if (textsecure.storage.user.getDeviceId() != '1') {
                var syncView = new SyncView().render();
                this.$('.sync-setting').append(syncView.el);
            }
        },
        events: {
            'click .close': 'remove',
            'click .clear-data': 'onClearData',
        },
        render_attributes: function() {
            return {
              deviceNameLabel: i18n('deviceName'),
              deviceName: this.deviceName,
              theme: i18n('theme'),
              notifications: i18n('notifications'),
              notificationSettingsDialog: i18n('notificationSettingsDialog'),
              settings: i18n('settings'),
              disableNotifications: i18n('disableNotifications'),
              nameAndMessage: i18n('nameAndMessage'),
              noNameOrMessage: i18n('noNameOrMessage'),
              nameOnly: i18n('nameOnly'),
              audioNotificationDescription: i18n('audioNotificationDescription'),
              isAudioNotificationSupported: Settings.isAudioNotificationSupported(),
              macDockBounceNotificationDescription: i18n('macDockBounceNotificationDescription'),
              windowsFlashFrameNotificationDescription: i18n('windowsFlashFrameNotificationDescription'),
              themeAndroidDark: i18n('themeAndroidDark'),
              hideMenuBar: i18n('hideMenuBar'),
              clearDataHeader: i18n('clearDataHeader'),
              clearDataButton: i18n('clearDataButton'),
              clearDataExplanation: i18n('clearDataExplanation'),
            };
        },
        onClearData: function() {
            var clearDataView = new ClearDataView().render();
            $('body').append(clearDataView.el);
        },
    });

    /* jshint ignore:start */
    /* eslint-enable */

  const CLEAR_DATA_STEPS = {
    CHOICE: 1,
    DELETING: 2,
  };
  const ClearDataView = Whisper.View.extend({
    templateName: 'clear-data',
    className: 'full-screen-flow overlay',
    events: {
      'click .cancel': 'onCancel',
      'click .delete-all-data': 'onDeleteAllData',
    },
    initialize() {
      this.step = CLEAR_DATA_STEPS.CHOICE;
    },
    onCancel() {
      this.remove();
    },
    async onDeleteAllData() {
      console.log('Deleting everything!');
      this.step = CLEAR_DATA_STEPS.DELETING;
      this.render();

      try {
        await Database.close();
        console.log('All database connections closed. Starting delete.');
      } catch (error) {
        console.log('Something went wrong closing all database connections.');
      }

      this.clearAllData();
    },
    async clearAllData() {
      try {
        await Promise.all([
          Logs.deleteAll(),
          Database.drop(),
        ]);
      } catch (error) {
        console.log(
          'Something went wrong deleting all data:',
          error && error.stack ? error.stack : error
        );
      }
      window.restart();
    },
    render_attributes() {
      return {
        isStep1: this.step === CLEAR_DATA_STEPS.CHOICE,
        header: i18n('deleteAllDataHeader'),
        body: i18n('deleteAllDataBody'),
        cancelButton: i18n('cancel'),
        deleteButton: i18n('deleteAllDataButton'),

        isStep2: this.step === CLEAR_DATA_STEPS.DELETING,
        deleting: i18n('deleteAllDataProgress'),
      };
    },
  });

    /* eslint-disable */
    /* jshint ignore:end */

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
