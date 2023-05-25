// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type { GlobalModalsStateType } from '../ducks/globalModals';

export const getGlobalModalsState = (state: StateType): GlobalModalsStateType =>
  state.globalModals;

export const isShowingAnyModal = createSelector(
  getGlobalModalsState,
  (globalModalsState): boolean =>
    Object.values(globalModalsState).some(value => Boolean(value))
);
