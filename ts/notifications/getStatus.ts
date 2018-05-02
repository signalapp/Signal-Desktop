interface Environment {
  isAppFocused: boolean;
  isAudioNotificationEnabled: boolean;
  isAudioNotificationSupported: boolean;
  isEnabled: boolean;
  numNotifications: number;
  hasNotificationSupport: boolean;
  userSetting: UserSetting;
}

interface Status {
  shouldClearNotifications: boolean;
  shouldPlayNotificationSound: boolean;
  shouldShowNotifications: boolean;
  hasNotificationSupport: boolean;
  type: Type;
}

type UserSetting = 'off' | 'count' | 'name' | 'message';

type Type =
  | 'ok'
  | 'disabled'
  | 'appIsFocused'
  | 'noNotifications'
  | 'userSetting';

export const getStatus = ({
  hasNotificationSupport,
  isAppFocused,
  isAudioNotificationEnabled,
  isAudioNotificationSupported,
  isEnabled,
  numNotifications,
  userSetting,
}: Environment): Status => {
  const type = ((): Type => {
    if (!isEnabled) {
      return 'disabled';
    }

    const hasNotifications = numNotifications > 0;
    if (!hasNotifications) {
      return 'noNotifications';
    }

    if (isAppFocused) {
      return 'appIsFocused';
    }

    if (userSetting === 'off') {
      return 'userSetting';
    }

    return 'ok';
  })();

  const shouldPlayNotificationSound =
    isAudioNotificationSupported &&
    isAudioNotificationEnabled &&
    hasNotificationSupport;
  const shouldShowNotifications = type === 'ok';
  const shouldClearNotifications = type === 'appIsFocused';

  return {
    hasNotificationSupport,
    shouldClearNotifications,
    shouldPlayNotificationSound,
    shouldShowNotifications,
    type,
  };
};
