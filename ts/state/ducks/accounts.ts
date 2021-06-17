// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ThunkAction } from 'redux-thunk';
import { StateType as RootStateType } from '../reducer';

import { NoopActionType } from './noop';

// State

export type AccountsStateType = {
  accounts: Record<string, boolean>;
};

// Actions

type AccountUpdateActionType = {
  type: 'accounts/UPDATE';
  payload: {
    identifier: string;
    hasAccount: boolean;
  };
};

export type AccountsActionType = AccountUpdateActionType;

// Action Creators

export const actions = {
  checkForAccount,
};

function checkForAccount(
  identifier: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  AccountUpdateActionType | NoopActionType
> {
  return async dispatch => {
    if (!window.textsecure.messaging) {
      dispatch({
        type: 'NOOP',
        payload: null,
      });
      return;
    }

    let hasAccount = false;

    try {
      await window.textsecure.messaging.getProfile(identifier);
      hasAccount = true;
    } catch (_error) {
      // Doing nothing with this failed fetch
    }

    dispatch({
      type: 'accounts/UPDATE',
      payload: {
        identifier,
        hasAccount,
      },
    });
  };
}

// Reducer

export function getEmptyState(): AccountsStateType {
  return {
    accounts: {},
  };
}

export function reducer(
  state: Readonly<AccountsStateType> = getEmptyState(),
  action: Readonly<AccountsActionType>
): AccountsStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'accounts/UPDATE') {
    const { payload } = action;
    const { identifier, hasAccount } = payload;

    return {
      ...state,
      accounts: {
        ...state.accounts,
        [identifier]: hasAccount,
      },
    };
  }

  return state;
}
