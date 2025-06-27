// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import { useBoundActions } from '../../hooks/useBoundActions';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { DonationReceipt } from '../../types/Donations';

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

export function addReceipt(receipt: DonationReceipt): AddReceiptAction {
  return {
    type: ADD_RECEIPT,
    payload: { receipt },
  };
}

export const actions = {
  addReceipt,
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
