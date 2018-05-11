/* global Signal:false */
/* global Backbone: false */

/* global ConversationController: false */
/* global drawAttention: false */
/* global i18n: false */
/* global isFocused: false */
/* global Signal: false */
/* global storage: false */
/* global Whisper: false */
/* global _: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = Signal.Types;

  const SettingNames = {
    COUNT: 'count',
    NAME: 'name',
    MESSAGE: 'message',
  };

  Whisper.Notifications = new (Backbone.Collection.extend({
    initialize() {
      this.isEnabled = false;
      this.on('add', this.update);
      this.on('remove', this.onRemove);

      this.lastNotification = null;

      // Testing indicated that trying to create/destroy notifications too quickly
      //   resulted in notifications that stuck around forever, requiring the user
      //   to manually close them. This introduces a minimum amount of time between calls,
      //   and batches up the quick successive update() calls we get from an incoming
      //   read sync, which might have a number of messages referenced inside of it.
      this.fastUpdate = this.update;
      this.update = _.debounce(this.update, 1000);
    },
    onClick(conversationId) {
      const conversation = ConversationController.get(conversationId);
      this.trigger('click', conversation);
    },
    update() {
      if (this.lastNotification) {
        this.lastNotification.close();
        this.lastNotification = null;
      }

      const { isEnabled } = this;
      const isAppFocused = isFocused();
      const isAudioNotificationEnabled =
        storage.get('audio-notification') || false;
      const isAudioNotificationSupported = Settings.isAudioNotificationSupported();
      const isNotificationGroupingSupported = Settings.isNotificationGroupingSupported();
      const numNotifications = this.length;
      const userSetting = this.getUserSetting();

      const status = Signal.Notifications.getStatus({
        isAppFocused,
        isAudioNotificationEnabled,
        isAudioNotificationSupported,
        isEnabled,
        numNotifications,
        userSetting,
      });

      console.log(
        'Update notifications:',
        Object.assign({}, status, {
          isNotificationGroupingSupported,
        })
      );

      if (status.type !== 'ok') {
        if (status.shouldClearNotifications) {
          this.reset([]);
        }

        return;
      }

      let title;
      let message;
      let iconUrl;

      // NOTE: i18n has more complex rules for pluralization than just
      // distinguishing between zero (0) and other (non-zero),
      // e.g. Russian:
      // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
      const newMessageCountLabel = `${numNotifications} ${
        numNotifications === 1 ? i18n('newMessage') : i18n('newMessages')
      }`;

      const last = this.last().toJSON();
      switch (userSetting) {
        case SettingNames.COUNT:
          title = 'Signal';
          message = newMessageCountLabel;
          break;
        case SettingNames.NAME: {
          const lastMessageTitle = last.title;
          title = newMessageCountLabel;
          // eslint-disable-next-line prefer-destructuring
          iconUrl = last.iconUrl;
          if (numNotifications === 1) {
            message = `${i18n('notificationFrom')} ${lastMessageTitle}`;
          } else {
            message = `${i18n(
              'notificationMostRecentFrom'
            )} ${lastMessageTitle}`;
          }
          break;
        }
        case SettingNames.MESSAGE:
          if (numNotifications === 1) {
            // eslint-disable-next-line prefer-destructuring
            title = last.title;
            // eslint-disable-next-line prefer-destructuring
            message = last.message;
          } else {
            title = newMessageCountLabel;
            message = `${i18n('notificationMostRecent')} ${last.message}`;
          }
          // eslint-disable-next-line prefer-destructuring
          iconUrl = last.iconUrl;
          break;
        default:
          console.log(
            `Error: Unknown user notification setting: '${userSetting}'`
          );
          break;
      }

      const shouldHideExpiringMessageBody =
        last.isExpiringMessage && Signal.OS.isMacOS();
      if (shouldHideExpiringMessageBody) {
        message = i18n('newMessage');
      }

      drawAttention();

      const notification = new Notification(title, {
        body: message,
        icon: iconUrl,
        tag: isNotificationGroupingSupported ? 'signal' : undefined,
        silent: !status.shouldPlayNotificationSound,
      });
      notification.onclick = () => this.onClick(last.conversationId);
      this.lastNotification = notification;

      // We continue to build up more and more messages for our notifications
      // until the user comes back to our app or closes the app. Then we’ll
      // clear everything out. The good news is that we'll have a maximum of
      // 1 notification in the Notification area (something like
      // ‘10 new messages’) assuming that `Notification::close` does its job.
    },
    getUserSetting() {
      return storage.get('notification-setting') || SettingNames.MESSAGE;
    },
    onRemove() {
      console.log('Remove notification');
      this.update();
    },
    clear() {
      console.log('Remove all notifications');
      this.reset([]);
      this.update();
    },
    // We don't usually call this, but when the process is shutting down, we should at
    //   least try to remove the notification immediately instead of waiting for the
    //   normal debounce.
    fastClear() {
      this.reset([]);
      this.fastUpdate();
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
