// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { UsernameReservationType } from '../../types/Username';
import type { StateType } from '../reducer';
import type {
  UsernameStateType,
  UsernameReservationStateType,
} from '../ducks/username';
import type {
  UsernameEditState,
  UsernameLinkState,
  UsernameReservationState,
  UsernameReservationError,
} from '../ducks/usernameEnums';

export const getUsernameState = (state: StateType): UsernameStateType =>
  state.username;

export const getUsernameEditState = createSelector(
  getUsernameState,
  (state: UsernameStateType): UsernameEditState => state.editState
);

export const getUsernameLinkState = createSelector(
  getUsernameState,
  (state: UsernameStateType): UsernameLinkState => state.linkState
);

export const getUsernameReservation = createSelector(
  getUsernameState,
  (state: UsernameStateType): UsernameReservationStateType =>
    state.usernameReservation
);

export const getUsernameReservationState = createSelector(
  getUsernameReservation,
  (reservation: UsernameReservationStateType): UsernameReservationState =>
    reservation.state
);

export const getUsernameReservationObject = createSelector(
  getUsernameReservation,
  (
    reservation: UsernameReservationStateType
  ): UsernameReservationType | undefined => reservation.reservation
);

export const getUsernameReservationError = createSelector(
  getUsernameReservation,
  (
    reservation: UsernameReservationStateType
  ): UsernameReservationError | undefined => reservation.error
);

export const getRecoveredUsername = createSelector(
  getUsernameReservation,
  (reservation: UsernameReservationStateType): string | undefined =>
    reservation.recoveredUsername
);
