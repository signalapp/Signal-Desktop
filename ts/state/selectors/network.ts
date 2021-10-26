// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { NetworkStateType } from '../ducks/network';
import { isDone } from '../../util/registration';
import { SocketStatus } from '../../types/SocketStatus';

const getNetwork = (state: StateType): NetworkStateType => state.network;

export const hasNetworkDialog = createSelector(
  getNetwork,
  isDone,
  (
    { isOnline, socketStatus, withinConnectingGracePeriod }: NetworkStateType,
    isRegistrationDone: boolean
  ): boolean =>
    isRegistrationDone &&
    (!isOnline ||
      (socketStatus === SocketStatus.CONNECTING &&
        !withinConnectingGracePeriod) ||
      socketStatus === SocketStatus.CLOSED ||
      socketStatus === SocketStatus.CLOSING)
);

export const isChallengePending = createSelector(
  getNetwork,
  ({ challengeStatus }) => challengeStatus === 'pending'
);
