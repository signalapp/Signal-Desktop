// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import { SocketStatus } from '../../types/SocketStatus';
import { trigger } from '../../shims/events';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type NetworkStateType = ReadonlyDeep<{
  isOnline: boolean;
  isOutage: boolean;
  socketStatus: SocketStatus;
  challengeStatus: 'required' | 'pending' | 'idle';
}>;

// Actions

const SET_NETWORK_STATUS = 'network/SET_NETWORK_STATUS';
const RELINK_DEVICE = 'network/RELINK_DEVICE';
const SET_CHALLENGE_STATUS = 'network/SET_CHALLENGE_STATUS';
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

type SetOutageActionType = ReadonlyDeep<{
  type: 'network/SET_OUTAGE';
  payload: {
    isOutage: boolean;
  };
}>;

export type NetworkActionType = ReadonlyDeep<
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

function relinkDevice(): RelinkDeviceActionType {
  trigger('setupAsNewDevice');

  return {
    type: RELINK_DEVICE,
  };
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

function setOutage(isOutage: boolean): SetOutageActionType {
  return {
    type: SET_OUTAGE,
    payload: { isOutage },
  };
}

export const actions = {
  setNetworkStatus,
  relinkDevice,
  setChallengeStatus,
  setOutage,
};

export const useNetworkActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): NetworkStateType {
  return {
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
