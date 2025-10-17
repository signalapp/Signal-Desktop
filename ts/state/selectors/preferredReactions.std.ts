// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type { PreferredReactionsStateType } from '../ducks/preferredReactions.preload.js';

const getPreferredReactionsState = (
  state: Readonly<StateType>
): PreferredReactionsStateType => state.preferredReactions;

export const getCustomizeModalState = createSelector(
  getPreferredReactionsState,
  (state: Readonly<PreferredReactionsStateType>) =>
    state.customizePreferredReactionsModal
);

export const getIsCustomizingPreferredReactions = createSelector(
  getCustomizeModalState,
  (customizeModal): boolean => Boolean(customizeModal)
);
