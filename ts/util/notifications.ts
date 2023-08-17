import { debounce, last } from 'lodash';
import { SettingsKey } from '../data/settings-key';
import { getStatus } from '../notifications';
import { UserSetting } from '../notifications/getStatus';
import { isMacOS } from '../OS';
import { isAudioNotificationSupported } from '../types/Settings';
import { isWindowFocused } from './focusListener';
import { Storage } from './storage';

const SettingNames = {
  COUNT: 'count',
  NAME: 'name',
  MESSAGE: 'message',
};

function filter(text?: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let sound: any;

export type SessionNotification = {
  conversationId: string;
  iconUrl: string | null;
  isExpiringMessage: boolean;
  message: string;
  messageId?: string;
  messageSentAt: number;
  title: string;
};

let isEnabled: boolean = false;
let lastNotificationDisplayed: null | Notification = null;

let currentNotifications: Array<SessionNotification> = [];

// Testing indicated that trying to create/destroy notifications too quickly
//   resulted in notifications that stuck around forever, requiring the user
//   to manually close them. This introduces a minimum amount of time between calls,
//   and batches up the quick successive update() calls we get from an incoming
//   read sync, which might have a number of messages referenced inside of it.
const debouncedUpdate = debounce(update, 2000);
const fastUpdate = update;

function clear() {
  // window.log.info('Remove all notifications');
  currentNotifications = [];
  debouncedUpdate();
}

// We don't usually call this, but when the process is shutting down, we should at
//   least try to remove the notification immediately instead of waiting for the
//   normal debounce.
function fastClear() {
  currentNotifications = [];
  fastUpdate();
}

function enable() {
  const needUpdate = !isEnabled;
  isEnabled = true;
  if (needUpdate) {
    debouncedUpdate();
  }
}

function disable() {
  isEnabled = false;
}

/**
 *
 * @param forceRefresh Should only be set when the user triggers a test notification from the settings
 */
function addNotification(notif: SessionNotification) {
  const alreadyThere = currentNotifications.find(
    n => n.conversationId === notif.conversationId && n.messageId === notif.messageId
  );

  if (alreadyThere) {
    return;
  }
  currentNotifications.push(notif);
  debouncedUpdate();
}

/**
 * Special case when we want to display a preview of what notifications looks like
 */
function addPreviewNotification(notif: SessionNotification) {
  currentNotifications.push(notif);
  update(true);
}

function clearByConversationID(convoId: string) {
  const oldLength = currentNotifications.length;
  currentNotifications = currentNotifications.filter(n => n.conversationId === convoId);
  if (oldLength !== currentNotifications.length) {
    onRemove();
  }
}

function clearByMessageId(messageId: string) {
  if (!messageId) {
    return;
  }
  const oldLength = currentNotifications.length;
  currentNotifications = currentNotifications.filter(n => n.messageId === messageId);
  if (oldLength !== currentNotifications.length) {
    onRemove();
  }
}

function update(forceRefresh = false) {
  if (lastNotificationDisplayed) {
    lastNotificationDisplayed.close();
    lastNotificationDisplayed = null;
  }

  const isAppFocused = isWindowFocused();
  const isAudioNotificationEnabled =
    (Storage.get(SettingsKey.settingsAudioNotification) as boolean) || false;
  const audioNotificationSupported = isAudioNotificationSupported();
  // const isNotificationGroupingSupported = Settings.isNotificationGroupingSupported();
  const numNotifications = currentNotifications.length;
  const userSetting = getUserSetting();

  const status = getStatus({
    isAppFocused: forceRefresh ? false : isAppFocused,
    isAudioNotificationEnabled,
    isAudioNotificationSupported: audioNotificationSupported,
    isEnabled,
    numNotifications,
    userSetting,
  });

  // window.log.info(
  //   'Update notifications:',
  //   Object.assign({}, status, {
  //     isNotificationGroupingSupported,
  //   })
  // );

  if (status.type !== 'ok') {
    if (status.shouldClearNotifications) {
      currentNotifications = [];
    }

    return;
  }

  let title;
  let message;
  let iconUrl;

  const messagesNotificationCount = currentNotifications.length;

  // NOTE: i18n has more complex rules for pluralization than just
  // distinguishing between zero (0) and other (non-zero),
  // e.g. Russian:
  // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
  const newMessageCountLabel = `${messagesNotificationCount} ${
    messagesNotificationCount === 1 ? window.i18n('newMessage') : window.i18n('newMessages')
  }`;

  if (!currentNotifications.length) {
    return;
  }

  const lastNotification = last(currentNotifications);

  if (!lastNotification) {
    return;
  }

  switch (userSetting) {
    case SettingNames.COUNT:
      title = 'Session';

      if (messagesNotificationCount > 0) {
        message = newMessageCountLabel;
      } else {
        return;
      }
      break;
    case SettingNames.NAME: {
      const lastMessageTitle = lastNotification.title;
      title = newMessageCountLabel;
      // eslint-disable-next-line prefer-destructuring
      iconUrl = lastNotification.iconUrl;
      if (messagesNotificationCount === 1) {
        message = `${window.i18n('notificationFrom')} ${lastMessageTitle}`;
      } else {
        message = window.i18n('notificationMostRecentFrom', [lastMessageTitle]);
      }
      break;
    }
    case SettingNames.MESSAGE:
      if (messagesNotificationCount === 1) {
        // eslint-disable-next-line prefer-destructuring
        title = lastNotification.title;
        // eslint-disable-next-line prefer-destructuring
        message = lastNotification.message;
      } else {
        title = newMessageCountLabel;
        message = `${window.i18n('notificationMostRecent')} ${lastNotification.message}`;
      }
      // eslint-disable-next-line prefer-destructuring
      iconUrl = lastNotification.iconUrl;
      break;
    default:
      window.log.error(`Error: Unknown user notification setting: '${userSetting}'`);
  }

  const shouldHideExpiringMessageBody = lastNotification.isExpiringMessage && isMacOS();
  if (shouldHideExpiringMessageBody) {
    message = window.i18n('newMessage');
  }

  window.drawAttention();
  if (status.shouldPlayNotificationSound) {
    if (!sound) {
      sound = new Audio('sound/new_message.mp3');
    }
    void sound.play();
  }
  lastNotificationDisplayed = new Notification(title || '', {
    body: window.platform === 'linux' ? filter(message) : message,
    icon: iconUrl || undefined,
    silent: true,
  });
  lastNotificationDisplayed.onclick = () => {
    window.openFromNotification(lastNotification.conversationId);
  };

  // We continue to build up more and more messages for our notifications
  // until the user comes back to our app or closes the app. Then we’ll
  // clear everything out. The good news is that we'll have a maximum of
  // 1 notification in the Notification area (something like
  // ‘10 new messages’) assuming that `Notification::close` does its job.
}
function getUserSetting() {
  return (Storage.get('notification-setting') as UserSetting) || SettingNames.MESSAGE;
}
function onRemove() {
  // window.log.info('Remove notification');
  debouncedUpdate();
}

export const Notifications = {
  addNotification,
  addPreviewNotification,
  disable,
  enable,
  clear,
  fastClear,
  clearByConversationID,
  clearByMessageId,
};
