// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { type LocalizerType, ThemeType } from '../../types/Util';
import type { AciString, PniString } from '../../types/ServiceId';
import type { LocaleMessagesType } from '../../types/I18N';
import type { MenuOptionsType } from '../../types/menu';

import type { StateType } from '../reducer';
import type { CallingStateType } from '../ducks/calling';
import type { UserStateType } from '../ducks/user';

import { isNightly, isBeta } from '../../util/version';

export const getUser = (state: StateType): UserStateType => state.user;

export const getUserNumber = createSelector(
  getUser,
  (state: UserStateType): string | undefined => state.ourNumber
);

export const getUserDeviceId = createSelector(
  getUser,
  (state: UserStateType): number | undefined => state.ourDeviceId
);

export const getRegionCode = createSelector(
  getUser,
  (state: UserStateType): string | undefined => state.regionCode
);

export const getUserConversationId = createSelector(
  getUser,
  (state: UserStateType): string | undefined => state.ourConversationId
);

export const getUserACI = createSelector(
  getUser,
  (state: UserStateType): AciString | undefined => state.ourAci
);

export const getUserPNI = createSelector(
  getUser,
  (state: UserStateType): PniString | undefined => state.ourPni
);

export const getIntl = createSelector(
  getUser,
  (state: UserStateType): LocalizerType => state.i18n
);

export const getLocaleMessages = createSelector(
  getUser,
  (state: UserStateType): LocaleMessagesType => state.localeMessages
);

export const getInteractionMode = createSelector(
  getUser,
  (state: UserStateType) => state.interactionMode
);

export const getAttachmentsPath = createSelector(
  getUser,
  (state: UserStateType): string => state.attachmentsPath
);

export const getStickersPath = createSelector(
  getUser,
  (state: UserStateType): string => state.stickersPath
);

export const getPlatform = createSelector(
  getUser,
  (state: UserStateType): string => state.platform
);

export const getTempPath = createSelector(
  getUser,
  (state: UserStateType): string => state.tempPath
);

export const getPreferredTheme = createSelector(
  getUser,
  (state: UserStateType): ThemeType => state.theme
);

// Also defined in calling selectors, redefined to avoid circular dependency
const getIsInFullScreenCall = createSelector(
  (state: StateType): CallingStateType => state.calling,
  (state: CallingStateType): boolean =>
    Boolean(
      state.activeCallState?.state === 'Active' && !state.activeCallState.pip
    )
);

export const getTheme = createSelector(
  getPreferredTheme,
  getIsInFullScreenCall,
  (theme: ThemeType, isInCall: boolean): ThemeType => {
    return isInCall ? ThemeType.dark : theme;
  }
);

const getVersion = createSelector(
  getUser,
  (state: UserStateType) => state.version
);

export const getIsNightly = createSelector(getVersion, isNightly);

export const getIsBeta = createSelector(getVersion, isBeta);

export const getIsMainWindowMaximized = createSelector(
  getUser,
  (state: UserStateType): boolean => state.isMainWindowMaximized
);

export const getIsMainWindowFullScreen = createSelector(
  getUser,
  (state: UserStateType): boolean => state.isMainWindowFullScreen
);

export const getMenuOptions = createSelector(
  getUser,
  (state: UserStateType): MenuOptionsType => state.menuOptions
);

export const getIsMacOS = createSelector(
  getPlatform,
  (platform: string): boolean => platform === 'darwin'
);
