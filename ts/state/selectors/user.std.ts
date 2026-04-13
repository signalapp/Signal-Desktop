// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { type LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { AciString, PniString } from '../../types/ServiceId.std.ts';

import type { StateType } from '../reducer.preload.ts';
import type { CallingStateType } from '../ducks/calling.preload.ts';
import type { UserStateType } from '../ducks/user.preload.ts';

import { isNightly } from '../../util/version.std.ts';

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

export const getInteractionMode = createSelector(
  getUser,
  (state: UserStateType) => state.interactionMode
);

export const getPlatform = createSelector(
  getUser,
  (state: UserStateType): string => state.platform
);

const getPreferredTheme = createSelector(
  getUser,
  (state: UserStateType): ThemeType => state.theme
);

// Also defined in calling selectors, redefined to avoid circular dependency
const getIsInFullScreenCall = createSelector(
  (state: StateType): CallingStateType => state.calling,
  (state: CallingStateType): boolean =>
    state.activeCallState?.state === 'Active' && !state.activeCallState.pip
);

export const getTheme = createSelector(
  getPreferredTheme,
  getIsInFullScreenCall,
  (theme: ThemeType, isInCall: boolean): ThemeType => {
    return isInCall ? ThemeType.dark : theme;
  }
);

export const getVersion = createSelector(
  getUser,
  (state: UserStateType) => state.version
);

export const getIsNightly = createSelector(getVersion, isNightly);

export const getIsMainWindowMaximized = createSelector(
  getUser,
  (state: UserStateType): boolean => state.isMainWindowMaximized
);

export const getIsMainWindowFullScreen = createSelector(
  getUser,
  (state: UserStateType): boolean => state.isMainWindowFullScreen
);

export const getIsMacOS = createSelector(
  getPlatform,
  (platform: string): boolean => platform === 'darwin'
);
