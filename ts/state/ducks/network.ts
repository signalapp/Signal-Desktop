// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import { SocketStatus } from '../../types/SocketStatus';
import { trigger } from '../../shims/events';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';

// State

export type NetworkStateType = ReadonlyDeep<{
  isOnline: boolean;
  isOutage: boolean;
  socketStatus: SocketStatus;
  withinConnectingGracePeriod: boolean;
  challengeStatus: 'required' | 'pending' | 'idle';
}>;

// Actions

const CHECK_NETWORK_STATUS = 'network/CHECK_NETWORK_STATUS';
const CLOSE_CONNECTING_GRACE_PERIOD = 'network/CLOSE_CONNECTING_GRACE_PERIOD';
const RELINK_DEVICE = 'network/RELINK_DEVICE';
const SET_CHALLENGE_STATUS = 'network/SET_CHALLENGE_STATUS';
const SET_OUTAGE = 'network/SET_OUTAGE';

export type CheckNetworkStatusPayloadType = ReadonlyDeep<{
  isOnline: boolean;
  socketStatus: SocketStatus;
}>;

type CheckNetworkStatusAction = ReadonlyDeep<{
  type: 'network/CHECK_NETWORK_STATUS';
  payload: CheckNetworkStatusPayloadType;
}>;

type CloseConnectingGracePeriodActionType = ReadonlyDeep<{
  type: 'network/CLOSE_CONNECTING_GRACE_PERIOD';
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
  | CheckNetworkStatusAction
  | CloseConnectingGracePeriodActionType
  | RelinkDeviceActionType
  | SetChallengeStatusActionType
  | SetOutageActionType
>;

// Action Creators

function checkNetworkStatus(
  payload: CheckNetworkStatusPayloadType
): CheckNetworkStatusAction {
  return {
    type: CHECK_NETWORK_STATUS,
    payload,
  };
}

function closeConnectingGracePeriod(): CloseConnectingGracePeriodActionType {
  return {
    type: CLOSE_CONNECTING_GRACE_PERIOD,
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
  checkNetworkStatus,
  closeConnectingGracePeriod,
  relinkDevice,
  setChallengeStatus,
  setOutage,
};

// Reducer

export function getEmptyState(): NetworkStateType {
  return {
    isOnline: navigator.onLine,
    isOutage: false,
    socketStatus: SocketStatus.OPEN,
    withinConnectingGracePeriod: true,
    challengeStatus: 'idle',
  };
}

export function reducer(
  state: Readonly<NetworkStateType> = getEmptyState(),
  action: Readonly<NetworkActionType>
): NetworkStateType {
  if (action.type === CHECK_NETWORK_STATUS) {
    const { isOnline, socketStatus } = action.payload;

    // This action is dispatched frequently. We avoid allocating a new object if nothing
    //   has changed to avoid an unnecessary re-render.
    return assignWithNoUnnecessaryAllocation(state, {
      isOnline,
      socketStatus,
    });
  }

  if (action.type === CLOSE_CONNECTING_GRACE_PERIOD) {
    return {
      ...state,
      withinConnectingGracePeriod: false,
    };
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
