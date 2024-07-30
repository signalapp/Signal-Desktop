// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { NetworkStateType } from '../ducks/network';
import { isDone } from '../../util/registration';

const getNetwork = (state: StateType): NetworkStateType => state.network;

export const getNetworkIsOnline = createSelector(
  getNetwork,
  ({ isOnline }) => isOnline
);

export const getNetworkIsOutage = createSelector(
  getNetwork,
  ({ isOutage }) => isOutage
);

export const getNetworkSocketStatus = createSelector(
  getNetwork,
  ({ socketStatus }) => socketStatus
);

export const hasNetworkDialog = createSelector(
  getNetwork,
  isDone,
  (
    { isOnline, isOutage }: NetworkStateType,
    isRegistrationDone: boolean
  ): boolean => isRegistrationDone && (!isOnline || isOutage)
);

export const getChallengeStatus = createSelector(
  getNetwork,
  ({ challengeStatus }) => challengeStatus
);

export const isChallengePending = createSelector(
  getNetwork,
  ({ challengeStatus }) => challengeStatus === 'pending'
);
