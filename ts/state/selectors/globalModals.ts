// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { GlobalModalsStateType } from '../ducks/globalModals';
import { UsernameOnboardingState } from '../../types/globalModals';

export const getGlobalModalsState = (state: StateType): GlobalModalsStateType =>
  state.globalModals;

export const isShowingAnyModal = createSelector(
  getGlobalModalsState,
  (globalModalsState): boolean =>
    Object.entries(globalModalsState).some(([key, value]) => {
      if (key === 'usernameOnboardingState') {
        return value === UsernameOnboardingState.Open;
      }

      return Boolean(value);
    })
);
