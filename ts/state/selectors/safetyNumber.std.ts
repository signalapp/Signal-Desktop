// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.ts';
import type { SafetyNumberStateType } from '../ducks/safetyNumber.preload.ts';

const getSafetyNumber = (state: StateType): SafetyNumberStateType =>
  state.safetyNumber;

export const getContactSafetyNumberSelector = createSelector(
  [getSafetyNumber],
  ({ contacts }) => {
    return (contactId: string) => {
      return contacts[contactId];
    };
  }
);
