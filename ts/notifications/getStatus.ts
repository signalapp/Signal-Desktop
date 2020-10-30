// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

interface Environment {
  isAppFocused: boolean;
  isAudioNotificationEnabled: boolean;
  isEnabled: boolean;
  hasNotifications: boolean;
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

export const getStatus = ({
  isAppFocused,
  isAudioNotificationEnabled,
  isEnabled,
  hasNotifications,
  userSetting,
}: Environment): Status => {
  const type = ((): Type => {
    if (!isEnabled) {
      return 'disabled';
    }

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

  return {
    shouldClearNotifications: type === 'appIsFocused',
    shouldPlayNotificationSound: isAudioNotificationEnabled,
    shouldShowNotifications: type === 'ok',
    type,
  };
};
