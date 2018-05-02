interface Environment {
  isAppFocused: boolean;
  isAudioNotificationEnabled: boolean;
  isAudioNotificationSupported: boolean;
  isEnabled: boolean;
  numNotifications: number;
  userSetting: UserSetting;
}

interface Status {
  shouldClearNotifications: boolean;
  shouldPlayNotificationSound: boolean;
  shouldShowNotifications: boolean;
  type: Type;
}

type UserSetting = 'off' | 'count' | 'name' | 'message';

type Type =
  | 'ok'
  | 'disabled'
  | 'appIsFocused'
  | 'noNotifications'
  | 'userSetting';

export const getStatus = (environment: Environment): Status => {
  const type = ((): Type => {
    if (!environment.isEnabled) {
      return 'disabled';
    }

    const hasNotifications = environment.numNotifications > 0;
    if (!hasNotifications) {
      return 'noNotifications';
    }

    if (environment.isAppFocused) {
      return 'appIsFocused';
    }

    if (environment.userSetting === 'off') {
      return 'userSetting';
    }

    return 'ok';
  })();

  const shouldPlayNotificationSound =
    environment.isAudioNotificationSupported &&
    environment.isAudioNotificationEnabled;
  const shouldShowNotifications = type === 'ok';
  const shouldClearNotifications = type === 'appIsFocused';

  return {
    shouldClearNotifications,
    shouldPlayNotificationSound,
    shouldShowNotifications,
    type,
  };
};
