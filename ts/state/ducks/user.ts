// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { trigger } from '../../shims/events';

import type { NoopActionType } from './noop';
import type { LocalizerType } from '../../types/Util';
import type { LocaleMessagesType } from '../../types/I18N';
import { ThemeType } from '../../types/Util';
import type { UUIDStringType } from '../../types/UUID';
import type { MenuOptionsType } from '../../types/menu';

// State

export type UserStateType = {
  attachmentsPath: string;
  stickersPath: string;
  tempPath: string;
  ourConversationId: string | undefined;
  ourDeviceId: number | undefined;
  ourACI: UUIDStringType | undefined;
  ourPNI: UUIDStringType | undefined;
  ourNumber: string | undefined;
  platform: string;
  regionCode: string | undefined;
  i18n: LocalizerType;
  localeMessages: LocaleMessagesType;
  interactionMode: 'mouse' | 'keyboard';
  isMainWindowMaximized: boolean;
  isMainWindowFullScreen: boolean;
  menuOptions: MenuOptionsType;
  theme: ThemeType;
  version: string;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourConversationId?: string;
    ourDeviceId?: number;
    ourACI?: UUIDStringType;
    ourPNI?: UUIDStringType;
    ourNumber?: string;
    regionCode?: string;
    interactionMode?: 'mouse' | 'keyboard';
    theme?: ThemeType;
    isMainWindowMaximized?: boolean;
    isMainWindowFullScreen?: boolean;
    menuOptions?: MenuOptionsType;
  };
};

export type UserActionType = UserChangedActionType;

// Action Creators

export const actions = {
  userChanged,
  manualReconnect,
};

function userChanged(attributes: {
  interactionMode?: 'mouse' | 'keyboard';
  ourConversationId?: string;
  ourDeviceId?: number;
  ourNumber?: string;
  ourACI?: UUIDStringType;
  ourPNI?: UUIDStringType;
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

// Reducer

export function getEmptyState(): UserStateType {
  return {
    attachmentsPath: 'missing',
    stickersPath: 'missing',
    tempPath: 'missing',
    ourConversationId: 'missing',
    ourDeviceId: 0,
    ourACI: undefined,
    ourPNI: undefined,
    ourNumber: 'missing',
    regionCode: 'missing',
    platform: 'missing',
    interactionMode: 'mouse',
    isMainWindowMaximized: false,
    isMainWindowFullScreen: false,
    menuOptions: {
      development: false,
      devTools: false,
      includeSetup: false,
      isProduction: true,
      platform: 'unknown',
    },
    theme: ThemeType.light,
    i18n: Object.assign(
      () => {
        throw new Error('i18n not yet set up');
      },
      {
        getLocale() {
          throw new Error('i18n not yet set up');
        },
      }
    ),
    localeMessages: {},
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
