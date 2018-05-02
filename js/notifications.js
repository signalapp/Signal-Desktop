/* global Backbone: false */
/* global nodeNotifier: false */

/* global config: false */
/* global ConversationController: false */
/* global drawAttention: false */
/* global i18n: false */
/* global isFocused: false */
/* global Signal: false */
/* global storage: false */
/* global Whisper: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = Signal.Types;

  const SettingNames = {
    OFF: 'off',
    COUNT: 'count',
    NAME: 'name',
    MESSAGE: 'message',
  };

  Whisper.Notifications = new (Backbone.Collection.extend({
    initialize() {
      this.isEnabled = false;
      this.on('add', this.update);
      this.on('remove', this.onRemove);
    },
    onClick(conversationId) {
      const conversation = ConversationController.get(conversationId);
      this.trigger('click', conversation);
    },
    update() {
      const { isEnabled } = this;
      const isAppFocused = isFocused();
      const isAudioNotificationEnabled =
        storage.get('audio-notification') || false;
      const isAudioNotificationSupported = Settings.isAudioNotificationSupported();
      const shouldPlayNotificationSound =
        isAudioNotificationSupported && isAudioNotificationEnabled;
      const numNotifications = this.length;
      console.log('Update notifications:', {
        isAppFocused,
        isEnabled,
        numNotifications,
        shouldPlayNotificationSound,
      });

      if (!isEnabled) {
        return;
      }

      const hasNotifications = numNotifications > 0;
      if (!hasNotifications) {
        return;
      }

      const isNotificationOmitted = isAppFocused;
      if (isNotificationOmitted) {
        this.clear();
        return;
      }

      const setting = this.getSetting();
      if (setting === SettingNames.OFF) {
        return;
      }

      drawAttention();

      let title;
      let message;
      let iconUrl;

      // NOTE: i18n has more complex rules for pluralization than just
      // distinguishing between zero (0) and other (non-zero),
      // e.g. Russian:
      // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
      const newMessageCount = [
        numNotifications,
        numNotifications === 1 ? i18n('newMessage') : i18n('newMessages'),
      ].join(' ');

      const last = this.last();
      switch (setting) {
        case SettingNames.COUNT:
          title = 'Signal';
          message = newMessageCount;
          break;
        case SettingNames.NAME:
          title = newMessageCount;
          message = `Most recent from ${last.get('title')}`;
          iconUrl = last.get('iconUrl');
          break;
        case SettingNames.MESSAGE:
          if (numNotifications === 1) {
            title = last.get('title');
          } else {
            title = newMessageCount;
          }
          message = last.get('message');
          iconUrl = last.get('iconUrl');
          break;
        default:
          console.log(`Error: Unknown setting: '${setting}'`);
          break;
      }

      if (config.polyfillNotifications) {
        nodeNotifier.notify({
          title,
          message,
          sound: false,
        });
        nodeNotifier.on('click', () => {
          last.get('conversationId');
        });
      } else {
        const notification = new Notification(title, {
          body: message,
          icon: iconUrl,
          tag: 'signal',
          silent: !shouldPlayNotificationSound,
        });

        notification.onclick = this.onClick.bind(
          this,
          last.get('conversationId')
        );
      }

      // We don't want to notify the user about these same messages again
      this.clear();
    },
    getSetting() {
      return storage.get('notification-setting') || SettingNames.MESSAGE;
    },
    onRemove() {
      console.log('remove notification');
    },
    clear() {
      console.log('remove all notifications');
      this.reset([]);
    },
    enable() {
      const needUpdate = !this.isEnabled;
      this.isEnabled = true;
      if (needUpdate) {
        this.update();
      }
    },
    disable() {
      this.isEnabled = false;
    },
  }))();
})();
