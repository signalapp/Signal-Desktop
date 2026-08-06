// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SocketStatus } from '../../types/SocketStatus.std.ts';
import { trigger } from '../../shims/events.dom.ts';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { noopAction } from './noop.std.ts';

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import type { NoopActionType } from './noop.std.ts';

// State

export type NetworkStateType = ReadonlyDeep<{
  hasClockSkew: boolean;
  isOnline: boolean;
  isOutage: boolean;
  socketStatus: SocketStatus;
  challengeStatus: 'required' | 'pending' | 'idle';
}>;

// Actions

const SET_NETWORK_STATUS = 'network/SET_NETWORK_STATUS';
const SET_CHALLENGE_STATUS = 'network/SET_CHALLENGE_STATUS';
const SET_CLOCK_SKEW = 'network/SET_CLOCK_SKEW';
const SET_OUTAGE = 'network/SET_OUTAGE';

export type SetNetworkStatusPayloadType = ReadonlyDeep<{
  isOnline: boolean;
  socketStatus: SocketStatus;
}>;

type SetNetworkStatusAction = ReadonlyDeep<{
  type: 'network/SET_NETWORK_STATUS';
  payload: SetNetworkStatusPayloadType;
}>;

type RelinkDeviceActionType = ReadonlyDeep<{
  type: 'network/RELINK_DEVICE';
}>;

type SetChallengeStatusActionType = ReadonlyDeep<{
  type: 'network/SET_CHALLENGE_STATUS';
  payload: {
    challengeStatus: NetworkStateType['challengeStatus'];
  };
}>;

type SetClockSkewAction = ReadonlyDeep<{
  type: 'network/SET_CLOCK_SKEW';
  payload: {
    hasClockSkew: boolean;
  };
}>;

type SetOutageActionType = ReadonlyDeep<{
  type: 'network/SET_OUTAGE';
  payload: {
    isOutage: boolean;
  };
}>;

export type NetworkActionType = ReadonlyDeep<
  | SetClockSkewAction
  | SetNetworkStatusAction
  | RelinkDeviceActionType
  | SetChallengeStatusActionType
  | SetOutageActionType
>;

// Action Creators

function setNetworkStatus(
  payload: SetNetworkStatusPayloadType
): SetNetworkStatusAction {
  return {
    type: SET_NETWORK_STATUS,
    payload,
  };
}

function relinkDevice(): NoopActionType {
  trigger('setupAsNewDevice');

  return noopAction('relinkDevice');
}

function reregister(): NoopActionType {
  trigger('setupAsStandalone');

  return noopAction('reregister');
}

function setChallengeStatus(
  challengeStatus: NetworkStateType['challengeStatus']
): SetChallengeStatusActionType {
  if (challengeStatus === 'required') {
    window.SignalCI?.handleEvent('captchaDialog', null);
  }
  return {
    type: SET_CHALLENGE_STATUS,
    payload: { challengeStatus },
  };
}

function setClockSkew(hasClockSkew: boolean): SetClockSkewAction {
  return {
    type: SET_CLOCK_SKEW,
    payload: { hasClockSkew },
  };
}

function setOutage(isOutage: boolean): SetOutageActionType {
  return {
    type: SET_OUTAGE,
    payload: { isOutage },
  };
}

export const actions = {
  setNetworkStatus,
  relinkDevice,
  reregister,
  setChallengeStatus,
  setClockSkew,
  setOutage,
};

export const useNetworkActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): NetworkStateType {
  return {
    hasClockSkew: false,
    isOnline: true,
    isOutage: false,
    socketStatus: SocketStatus.OPEN,
    challengeStatus: 'idle',
  };
}

export function reducer(
  state: Readonly<NetworkStateType> = getEmptyState(),
  action: Readonly<NetworkActionType>
): NetworkStateType {
  if (action.type === SET_NETWORK_STATUS) {
    const { isOnline, socketStatus } = action.payload;

    // This action is dispatched frequently. We avoid allocating a new object if nothing
    //   has changed to avoid an unnecessary re-render.
    return assignWithNoUnnecessaryAllocation(state, {
      isOnline,
      socketStatus,
    });
  }

  if (action.type === SET_CHALLENGE_STATUS) {
    return {
      ...state,
      challengeStatus: action.payload.challengeStatus,
    };
  }

  if (action.type === SET_CLOCK_SKEW) {
    return {
      ...state,
      hasClockSkew: action.payload.hasClockSkew,
    };
  }

  if (action.type === SET_OUTAGE) {
    const { isOutage } = action.payload;

    // This action is dispatched frequently when offline.
    // We avoid allocating a new object if nothing has changed to
    // avoid an unnecessary re-render.
    return assignWithNoUnnecessaryAllocation(state, {
      isOutage,
    });
  }

  return state;
}
