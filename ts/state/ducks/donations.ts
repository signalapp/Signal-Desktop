// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { useBoundActions } from '../../hooks/useBoundActions';
import { createLogger } from '../../logging/log';
import * as Errors from '../../types/errors';
import { isStagingServer } from '../../util/isStagingServer';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { DonationReceipt } from '../../types/Donations';
import type { StateType as RootStateType } from '../reducer';
import { DataWriter } from '../../sql/Client';

const log = createLogger('donations');

// State

export type DonationsStateType = ReadonlyDeep<{
  receipts: Array<DonationReceipt>;
}>;

// Actions

export const ADD_RECEIPT = 'donations/ADD_RECEIPT';

export type AddReceiptAction = ReadonlyDeep<{
  type: typeof ADD_RECEIPT;
  payload: { receipt: DonationReceipt };
}>;

export type DonationsActionType = ReadonlyDeep<AddReceiptAction>;

// Action Creators

export function internalAddDonationReceipt(
  receipt: DonationReceipt
): ThunkAction<void, RootStateType, unknown, AddReceiptAction> {
  return async dispatch => {
    if (!isStagingServer()) {
      log.error('internalAddDonationReceipt: Only available on staging server');
      throw new Error('This feature is only available on staging server');
    }

    try {
      await DataWriter.createDonationReceipt(receipt);

      dispatch({
        type: ADD_RECEIPT,
        payload: { receipt },
      });
    } catch (error) {
      log.error('Error adding donation receipt', Errors.toLogFormat(error));
      throw error;
    }
  };
}

export const actions = {
  internalAddDonationReceipt,
};

export const useDonationsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): DonationsStateType {
  return {
    receipts: [],
  };
}

export function reducer(
  state: Readonly<DonationsStateType> = getEmptyState(),
  action: Readonly<DonationsActionType>
): DonationsStateType {
  if (action.type === ADD_RECEIPT) {
    return {
      ...state,
      receipts: [...state.receipts, action.payload.receipt],
    };
  }

  return state;
}
