// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { ReadonlyDeep } from 'type-fest';
import * as Errors from '../../types/errors';
import * as log from '../../logging/log';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { StateType as RootStateType } from '../reducer';
import type { ServiceIdString } from '../../types/ServiceId';
import { getServiceIdsForE164s } from '../../util/getServiceIdsForE164s';
import { useBoundActions } from '../../hooks/useBoundActions';

import type { NoopActionType } from './noop';

// State

export type AccountsStateType = ReadonlyDeep<{
  accounts: Record<string, ServiceIdString | undefined>;
}>;

// Actions

type AccountUpdateActionType = ReadonlyDeep<{
  type: 'accounts/UPDATE';
  payload: {
    phoneNumber: string;
    serviceId?: ServiceIdString;
  };
}>;

export type AccountsActionType = ReadonlyDeep<AccountUpdateActionType>;

// Action Creators

export const actions = {
  checkForAccount,
};

export const useAccountsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function checkForAccount(
  phoneNumber: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  AccountUpdateActionType | NoopActionType
> {
  return async (dispatch, getState) => {
    const { server } = window.textsecure;
    if (!server) {
      dispatch({
        type: 'NOOP',
        payload: null,
      });
      return;
    }

    const conversation = window.ConversationController.get(phoneNumber);
    if (conversation && conversation.getServiceId()) {
      log.info(`checkForAccount: found ${phoneNumber} in existing contacts`);
      const serviceId = conversation.getServiceId();

      dispatch({
        type: 'accounts/UPDATE',
        payload: {
          phoneNumber,
          serviceId,
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
      return;
    }

    let serviceId: ServiceIdString | undefined;

    log.info(`checkForAccount: looking ${phoneNumber} up on server`);
    try {
      const { entries: serviceIdLookup, transformedE164s } =
        await getServiceIdsForE164s(server, [phoneNumber]);
      const phoneNumberToUse = transformedE164s.get(phoneNumber) ?? phoneNumber;
      const maybePair = serviceIdLookup.get(phoneNumberToUse);

      if (maybePair) {
        const { conversation: maybeMerged } =
          window.ConversationController.maybeMergeContacts({
            aci: maybePair.aci,
            pni: maybePair.pni,
            e164: phoneNumberToUse,
            reason: 'checkForAccount',
          });
        serviceId = maybeMerged.getServiceId();
      }
    } catch (error) {
      log.error('checkForAccount:', Errors.toLogFormat(error));
    }

    dispatch({
      type: 'accounts/UPDATE',
      payload: {
        phoneNumber,
        serviceId,
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
    const { phoneNumber, serviceId } = payload;

    return {
      ...state,
      accounts: {
        ...state.accounts,
        [phoneNumber]: serviceId,
      },
    };
  }

  return state;
}
