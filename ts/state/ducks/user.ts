// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import { trigger } from '../../shims/events';
import type { LocaleMessagesType } from '../../types/I18N';
import type { LocalizerType } from '../../types/Util';
import type { MenuOptionsType } from '../../types/menu';
import type { NoopActionType } from './noop';
import type { AciString, PniString } from '../../types/ServiceId';
import OS from '../../util/os/osMain';
import { ThemeType } from '../../types/Util';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type UserStateType = Readonly<{
  attachmentsPath: string;
  i18n: LocalizerType;
  interactionMode: 'mouse' | 'keyboard';
  isMainWindowFullScreen: boolean;
  isMainWindowMaximized: boolean;
  localeMessages: LocaleMessagesType;
  menuOptions: MenuOptionsType;
  osName: 'linux' | 'macos' | 'windows' | undefined;
  ourAci: AciString | undefined;
  ourConversationId: string | undefined;
  ourDeviceId: number | undefined;
  ourNumber: string | undefined;
  ourPni: PniString | undefined;
  platform: string;
  regionCode: string | undefined;
  stickersPath: string;
  tempPath: string;
  theme: ThemeType;
  version: string;
}>;

// Actions

type UserChangedActionType = ReadonlyDeep<{
  type: 'USER_CHANGED';
  payload: {
    ourConversationId?: string;
    ourDeviceId?: number;
    ourAci?: AciString;
    ourPni?: PniString;
    ourNumber?: string;
    regionCode?: string;
    interactionMode?: 'mouse' | 'keyboard';
    theme?: ThemeType;
    isMainWindowMaximized?: boolean;
    isMainWindowFullScreen?: boolean;
    menuOptions?: MenuOptionsType;
  };
}>;

export const ERASE_STORAGE_SERVICE = 'user/ERASE_STORAGE_SERVICE_STATE';
export type EraseStorageServiceStateAction = ReadonlyDeep<{
  type: typeof ERASE_STORAGE_SERVICE;
}>;

export type UserActionType = ReadonlyDeep<
  UserChangedActionType | EraseStorageServiceStateAction
>;

// Action Creators

export const actions = {
  eraseStorageServiceState,
  userChanged,
  manualReconnect,
};

export const useUserActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function eraseStorageServiceState(): EraseStorageServiceStateAction {
  return {
    type: ERASE_STORAGE_SERVICE,
  };
}

function userChanged(attributes: {
  interactionMode?: 'mouse' | 'keyboard';
  ourConversationId?: string;
  ourDeviceId?: number;
  ourNumber?: string;
  ourAci?: AciString;
  ourPni?: PniString;
  regionCode?: string;
  theme?: ThemeType;
  isMainWindowMaximized?: boolean;
  isMainWindowFullScreen?: boolean;
  menuOptions?: MenuOptionsType;
}): UserChangedActionType {
  return {
    type: 'USER_CHANGED',
    payload: attributes,
  };
}

function manualReconnect(): NoopActionType {
  trigger('manualConnect');

  return {
    type: 'NOOP',
    payload: null,
  };
}

const intlNotSetup = () => {
  throw new Error('i18n not yet set up');
};

// Reducer

export function getEmptyState(): UserStateType {
  let osName: 'windows' | 'macos' | 'linux' | undefined;

  if (OS.isWindows()) {
    osName = 'windows';
  } else if (OS.isMacOS()) {
    osName = 'macos';
  } else if (OS.isLinux()) {
    osName = 'linux';
  }

  return {
    attachmentsPath: 'missing',
    i18n: Object.assign(intlNotSetup, {
      getLocale: intlNotSetup,
      getIntl: intlNotSetup,
      getLocaleMessages: intlNotSetup,
      getLocaleDirection: intlNotSetup,
      getHourCyclePreference: intlNotSetup,
    }),
    interactionMode: 'mouse',
    isMainWindowMaximized: false,
    isMainWindowFullScreen: false,
    localeMessages: {},
    menuOptions: {
      development: false,
      devTools: false,
      includeSetup: false,
      isProduction: true,
      platform: 'unknown',
    },
    osName,
    ourAci: undefined,
    ourConversationId: 'missing',
    ourDeviceId: 0,
    ourNumber: 'missing',
    ourPni: undefined,
    platform: 'missing',
    regionCode: 'missing',
    stickersPath: 'missing',
    tempPath: 'missing',
    theme: ThemeType.light,
    version: '0.0.0',
  };
}

export function reducer(
  state: Readonly<UserStateType> = getEmptyState(),
  action: Readonly<UserActionType>
): UserStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'USER_CHANGED') {
    const { payload } = action;

    return {
      ...state,
      ...payload,
    };
  }

  return state;
}
