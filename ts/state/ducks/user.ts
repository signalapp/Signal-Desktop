// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { trigger } from '../../shims/events';

import type { NoopActionType } from './noop';
import type { LocalizerType } from '../../types/Util';
import { ThemeType } from '../../types/Util';
import type { UUIDStringType } from '../../types/UUID';

// State

export type UserStateType = {
  attachmentsPath: string;
  stickersPath: string;
  tempPath: string;
  ourConversationId: string;
  ourDeviceId: number;
  ourUuid: UUIDStringType;
  ourNumber: string;
  platform: string;
  regionCode: string;
  i18n: LocalizerType;
  interactionMode: 'mouse' | 'keyboard';
  theme: ThemeType;
};

// Actions

type UserChangedActionType = {
  type: 'USER_CHANGED';
  payload: {
    ourConversationId?: string;
    ourDeviceId?: number;
    ourUuid?: UUIDStringType;
    ourNumber?: string;
    regionCode?: string;
    interactionMode?: 'mouse' | 'keyboard';
    theme?: ThemeType;
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
  ourUuid?: UUIDStringType;
  regionCode?: string;
  theme?: ThemeType;
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
    ourUuid: '00000000-0000-4000-8000-000000000000',
    ourNumber: 'missing',
    regionCode: 'missing',
    platform: 'missing',
    interactionMode: 'mouse',
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
