import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import { NetworkStateType } from '../ducks/network';
import { isDone } from '../../util/registration';

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
      (socketStatus === WebSocket.CONNECTING && !withinConnectingGracePeriod) ||
      socketStatus === WebSocket.CLOSED ||
      socketStatus === WebSocket.CLOSING)
);
