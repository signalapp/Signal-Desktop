/* global i18n: false */
/* global Whisper: false */
/* global $: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = window.Signal.Types;

  const CheckboxView = Whisper.View.extend({
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
      const value = e.target.checked;
      this.setFn(value);
      window.log.info(this.name, 'changed to', value);
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
      window.log.info('media-permissions changed to', this.value);
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
      window.log.info(this.name, 'changed to', value);
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
        setFn: theme => {
          $(document.body)
            .removeClass('dark-theme')
            .removeClass('light-theme')
            .addClass(
              `${theme === 'system' ? window.systemTheme : theme}-theme`
            );
          window.setThemeSetting(theme);
        },
      });
      if (Settings.isAudioNotificationSupported()) {
        new CheckboxView({
          el: this.$('.audio-notification-setting'),
          name: 'audio-notification-setting',
          value: window.initialData.audioNotification,
          setFn: window.setAudioNotification,
        });
      }
      new CheckboxView({
        el: this.$('.spell-check-setting'),
        name: 'spell-check-setting',
        value: window.initialData.spellCheck,
        setFn: val => {
          const $msg = this.$('.spell-check-setting-message');
          if (val !== window.appStartInitialSpellcheckSetting) {
            $msg.show();
            $msg.attr('aria-hidden', false);
          } else {
            $msg.hide();
            $msg.attr('aria-hidden', true);
          }
          window.setSpellCheck(val);
        },
      });
      if (Settings.isHideMenuBarSupported()) {
        new CheckboxView({
          el: this.$('.menu-bar-setting'),
          name: 'menu-bar-setting',
          value: window.initialData.hideMenuBar,
          setFn: window.setHideMenuBar,
        });
      }
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
      const appStartSpellCheck = window.appStartInitialSpellcheckSetting;
      const spellCheckDirty =
        window.initialData.spellCheck !== appStartSpellCheck;

      return {
        deviceNameLabel: i18n('deviceName'),
        deviceName: window.initialData.deviceName,
        theme: i18n('theme'),
        notifications: i18n('notifications'),
        notificationSettingsDialog: i18n('notificationSettingsDialog'),
        settings: i18n('Keyboard--preferences'),
        disableNotifications: i18n('disableNotifications'),
        nameAndMessage: i18n('nameAndMessage'),
        noNameOrMessage: i18n('noNameOrMessage'),
        nameOnly: i18n('nameOnly'),
        audioNotificationDescription: i18n('audioNotificationDescription'),
        isAudioNotificationSupported: Settings.isAudioNotificationSupported(),
        isHideMenuBarSupported: Settings.isHideMenuBarSupported(),
        hasSystemTheme: true,
        themeLight: i18n('themeLight'),
        themeDark: i18n('themeDark'),
        themeSystem: i18n('themeSystem'),
        hideMenuBar: i18n('hideMenuBar'),
        clearDataHeader: i18n('clearDataHeader'),
        clearDataButton: i18n('clearDataButton'),
        clearDataExplanation: i18n('clearDataExplanation'),
        permissions: i18n('permissions'),
        mediaPermissionsDescription: i18n('mediaPermissionsDescription'),
        generalHeader: i18n('general'),
        spellCheckDescription: i18n('spellCheckDescription'),
        spellCheckHidden: spellCheckDirty ? 'false' : 'true',
        spellCheckDisplay: spellCheckDirty ? 'inherit' : 'none',
        spellCheckDirtyText: appStartSpellCheck
          ? i18n('spellCheckWillBeDisabled')
          : i18n('spellCheckWillBeEnabled'),
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
      window.log.info('sync successful');
      this.enable();
      this.render();
    },
    ontimeout() {
      window.log.error('sync timed out');
      this.$('.synced_at').hide();
      this.$('.sync_failed').show();
      this.enable();
    },
    async sync() {
      this.$('.sync_failed').hide();
      if (window.initialData.isPrimary) {
        window.log.warn('Tried to sync from device 1');
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
