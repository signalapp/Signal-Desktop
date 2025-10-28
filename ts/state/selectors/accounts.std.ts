// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type { AccountsStateType } from '../ducks/accounts.preload.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';

export const getAccounts = (state: StateType): AccountsStateType =>
  state.accounts;

export type AccountSelectorType = (
  identifier?: string
) => ServiceIdString | undefined;
export const getAccountSelector = createSelector(
  getAccounts,
  (accounts: AccountsStateType): AccountSelectorType => {
    return (identifier?: string) => {
      if (!identifier) {
        return undefined;
      }

      return accounts.accounts[identifier] || undefined;
    };
  }
);
