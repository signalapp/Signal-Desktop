/* global Signal:false */

(function() {
  'use strict';
  window.Whisper = window.Whisper || {};
  const { Settings } = Signal.Types;

  var SETTINGS = {
    OFF: 'off',
    COUNT: 'count',
    NAME: 'name',
    MESSAGE: 'message',
  };

  Whisper.Notifications = new (Backbone.Collection.extend({
    initialize: function() {
      this.isEnabled = false;
      this.on('add', this.update);
      this.on('remove', this.onRemove);

      this.lastNotification = null;
    },
    onClick: function(conversationId) {
      var conversation = ConversationController.get(conversationId);
      this.trigger('click', conversation);
    },
    update: function() {
      const { isEnabled } = this;
      const isFocused = window.isFocused();
      const isAudioNotificationEnabled =
        storage.get('audio-notification') || false;
      const isAudioNotificationSupported = Settings.isAudioNotificationSupported();
      const userSetting = this.getSetting();
      const shouldPlayNotificationSound =
        isAudioNotificationSupported && isAudioNotificationEnabled;
      const numNotifications = this.length;
      console.log('Update notifications:', {
        userSetting,
        isFocused,
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

      const isNotificationOmitted = isFocused;
      if (isNotificationOmitted) {
        this.clear();
        return;
      }

      if (userSetting === SETTINGS.OFF) {
        return;
      }

      window.drawAttention();

      var title;
      var message;
      var iconUrl;

      // NOTE: i18n has more complex rules for pluralization than just
      // distinguishing between zero (0) and other (non-zero),
      // e.g. Russian:
      // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
      var newMessageCountLabel = `${numNotifications} ${
        numNotifications === 1 ? i18n('newMessage') : i18n('newMessages')
      }`;

      const last = this.last();
      const lastJSON = last.toJSON();
      switch (userSetting) {
        case SETTINGS.COUNT:
          title = 'Signal';
          message = newMessageCountLabel;
          break;
        case SETTINGS.NAME:
          const lastMessageTitle = last.get('title');
          title = newMessageCountLabel;
          iconUrl = last.get('iconUrl');
          if (numNotifications === 1) {
            message = `${i18n('notificationFrom')} ${lastMessageTitle}`;
          } else {
            message = `${i18n(
              'notificationMostRecentFrom'
            )} ${lastMessageTitle}`;
          }
          break;
        case SETTINGS.MESSAGE:
          if (numNotifications === 1) {
            title = last.get('title');
            message = last.get('message');
          } else {
            title = newMessageCountLabel;
            message = `${i18n('notificationMostRecent')} ${last.get(
              'message'
            )}`;
          }
          iconUrl = last.get('iconUrl');
          break;
      }

      const shouldHideExpiringMessageBody =
        lastJSON.isExpiringMessage && Signal.OS.isMacOS();
      if (shouldHideExpiringMessageBody) {
        message = i18n('newMessage');
      }

      if (window.config.polyfillNotifications) {
        window.nodeNotifier.notify({
          title: title,
          message: message,
          sound: false,
        });
        window.nodeNotifier.on('click', function(notifierObject, options) {
          last.get('conversationId');
        });
      } else {
        if (this.lastNotification) {
          this.lastNotification.close();
        }
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
        this.lastNotification = notification;
      }

      // We continue to build up more and more messages for our notifications until
      //   the user comes back to our app or closes the app. Then we'll clear everything
      //   out. The good news is that we'll have a maximum of 1 notification in the
      //   Notification area (something like '10 new messages') assuming that close() does
      //   its job.
    },
    getSetting: function() {
      return storage.get('notification-setting') || SETTINGS.MESSAGE;
    },
    onRemove: function() {
      console.log('Remove notification');
      if (this.length === 0) {
        this.clear();
      } else {
        this.update();
      }
    },
    clear: function() {
      console.log('Remove all notifications');
      if (this.lastNotification) {
        this.lastNotification.close();
      }
      this.reset([]);
    },
    enable: function() {
      const needUpdate = !this.isEnabled;
      this.isEnabled = true;
      if (needUpdate) {
        this.update();
      }
    },
    disable: function() {
      this.isEnabled = false;
    },
  }))();
})();
