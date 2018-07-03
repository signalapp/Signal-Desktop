/* global i18n: false */
/* global Whisper: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = window.Signal.Types;

  const CheckboxView = Whisper.View.extend({
    initialize(options) {
      this.setFn = options.setFn;
      this.value = options.value;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      const value = e.target.checked;
      this.setFn(value);
      console.log(this.name, 'changed to', value);
    },
    populate() {
      this.$('input').prop('checked', !!this.value);
    },
  });

  const MediaPermissionsSettingView = Whisper.View.extend({
    initialize(options) {
      this.value = options.value;
      this.setFn = options.setFn;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      this.value = e.target.checked;
      this.setFn(this.value);
      console.log('media-permissions changed to', this.value);
    },
    populate() {
      this.$('input').prop('checked', Boolean(this.value));
    },
  });

  const RadioButtonGroupView = Whisper.View.extend({
    initialize(options) {
      this.name = options.name;
      this.setFn = options.setFn;
      this.value = options.value;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      const value = this.$(e.target).val();
      this.setFn(value);
      console.log(this.name, 'changed to', value);
    },
    populate() {
      this.$(`#${this.name}-${this.value}`).attr('checked', 'checked');
    },
  });
  Whisper.SettingsView = Whisper.View.extend({
    className: 'settings modal expand',
    templateName: 'settings',
    initialize() {
      this.render();
      new RadioButtonGroupView({
        el: this.$('.notification-settings'),
        name: 'notification-setting',
        value: window.initialData.notificationSetting,
        setFn: window.setNotificationSetting,
      });
      new RadioButtonGroupView({
        el: this.$('.theme-settings'),
        name: 'theme-setting',
        value: window.initialData.themeSetting,
        setFn: window.setThemeSetting,
      });
      if (Settings.isAudioNotificationSupported()) {
        new CheckboxView({
          el: this.$('.audio-notification-setting'),
          value: window.initialData.audioNotification,
          setFn: window.setAudioNotification,
        });
      }
      new CheckboxView({
        el: this.$('.menu-bar-setting'),
        value: window.initialData.hideMenuBar,
        setFn: window.setHideMenuBar,
      });
      new MediaPermissionsSettingView({
        el: this.$('.media-permissions'),
        value: window.initialData.mediaPermissions,
        setFn: window.setMediaPermissions,
      });
      if (!window.initialData.isPrimary) {
        const syncView = new SyncView().render();
        this.$('.sync-setting').append(syncView.el);
      }
    },
    events: {
      'click .close': 'onClose',
      'click .clear-data': 'onClearData',
    },
    render_attributes() {
      return {
        deviceNameLabel: i18n('deviceName'),
        deviceName: window.initialData.deviceName,
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
        themeAndroidDark: i18n('themeAndroidDark'),
        hideMenuBar: i18n('hideMenuBar'),
        clearDataHeader: i18n('clearDataHeader'),
        clearDataButton: i18n('clearDataButton'),
        clearDataExplanation: i18n('clearDataExplanation'),
        permissions: i18n('permissions'),
        mediaPermissionsDescription: i18n('mediaPermissionsDescription'),
      };
    },
    onClose() {
      window.closeSettings();
    },
    onClearData() {
      window.deleteAllData();
      window.closeSettings();
    },
  });

  const SyncView = Whisper.View.extend({
    templateName: 'syncSettings',
    className: 'syncSettings',
    events: {
      'click .sync': 'sync',
    },
    initialize() {
      this.lastSyncTime = window.initialData.lastSyncTime;
    },
    enable() {
      this.$('.sync').text(i18n('syncNow'));
      this.$('.sync').removeAttr('disabled');
    },
    disable() {
      this.$('.sync').attr('disabled', 'disabled');
      this.$('.sync').text(i18n('syncing'));
    },
    onsuccess() {
      window.setLastSyncTime(Date.now());
      this.lastSyncTime = Date.now();
      console.log('sync successful');
      this.enable();
      this.render();
    },
    ontimeout() {
      console.log('sync timed out');
      this.$('.synced_at').hide();
      this.$('.sync_failed').show();
      this.enable();
    },
    async sync() {
      this.$('.sync_failed').hide();
      if (window.initialData.isPrimary) {
        console.log('Tried to sync from device 1');
        return;
      }

      this.disable();
      try {
        await window.makeSyncRequest();
        this.onsuccess();
      } catch (error) {
        this.ontimeout();
      }
    },
    render_attributes() {
      const attrs = {
        sync: i18n('sync'),
        syncNow: i18n('syncNow'),
        syncExplanation: i18n('syncExplanation'),
        syncFailed: i18n('syncFailed'),
      };
      let date = this.lastSyncTime;
      if (date) {
        date = new Date(date);
        attrs.lastSynced = i18n('lastSynced');
        attrs.syncDate = date.toLocaleDateString();
        attrs.syncTime = date.toLocaleTimeString();
      }
      return attrs;
    },
  });
})();
