// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import * as Errors from '../../types/errors';
import * as log from '../../logging/log';

import type { StateType as RootStateType } from '../reducer';
import type { UUIDStringType } from '../../types/UUID';

import type { NoopActionType } from './noop';

// State

export type AccountsStateType = {
  accounts: Record<string, UUIDStringType | undefined>;
};

// Actions

type AccountUpdateActionType = {
  type: 'accounts/UPDATE';
  payload: {
    phoneNumber: string;
    uuid?: UUIDStringType;
  };
};

export type AccountsActionType = AccountUpdateActionType;

// Action Creators

export const actions = {
  checkForAccount,
};

function checkForAccount(
  phoneNumber: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  AccountUpdateActionType | NoopActionType
> {
  return async (dispatch, getState) => {
    if (!window.textsecure.messaging) {
      dispatch({
        type: 'NOOP',
        payload: null,
      });
      return;
    }

    const conversation = window.ConversationController.get(phoneNumber);
    if (conversation && conversation.get('uuid')) {
      log.info(`checkForAccount: found ${phoneNumber} in existing contacts`);
      const uuid = conversation.get('uuid');

      dispatch({
        type: 'accounts/UPDATE',
        payload: {
          phoneNumber,
          uuid,
        },
      });
      return;
    }

    const state = getState();
    const existing = Object.prototype.hasOwnProperty.call(
      state.accounts.accounts,
      phoneNumber
    );
    if (existing) {
      dispatch({
        type: 'NOOP',
        payload: null,
      });
    }

    let uuid: UUIDStringType | undefined;

    log.info(`checkForAccount: looking ${phoneNumber} up on server`);
    try {
      const uuidLookup = await window.textsecure.messaging.getUuidsForE164s([
        phoneNumber,
      ]);
      uuid = uuidLookup[phoneNumber] || undefined;
    } catch (error) {
      log.error('checkForAccount:', Errors.toLogFormat(error));
    }

    dispatch({
      type: 'accounts/UPDATE',
      payload: {
        phoneNumber,
        uuid,
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
    const { phoneNumber, uuid } = payload;

    return {
      ...state,
      accounts: {
        ...state.accounts,
        [phoneNumber]: uuid,
      },
    };
  }

  return state;
}
