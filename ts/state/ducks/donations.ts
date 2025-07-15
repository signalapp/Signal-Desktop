// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { useBoundActions } from '../../hooks/useBoundActions';
import { createLogger } from '../../logging/log';
import * as Errors from '../../types/errors';
import { isStagingServer } from '../../util/isStagingServer';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type {
  CardDetail,
  DonationErrorType,
  DonationReceipt,
  DonationWorkflow,
  StripeDonationAmount,
} from '../../types/Donations';
import type { StateType as RootStateType } from '../reducer';
import { DataWriter } from '../../sql/Client';
import * as donations from '../../services/donations';

const log = createLogger('donations');

// State

export type DonationsStateType = ReadonlyDeep<{
  currentWorkflow: DonationWorkflow | undefined;
  lastError: DonationErrorType | undefined;
  receipts: Array<DonationReceipt>;
}>;

// Actions

export const ADD_RECEIPT = 'donations/ADD_RECEIPT';
export const SUBMIT_DONATION = 'donations/SUBMIT_DONATION';
export const UPDATE_WORKFLOW = 'donations/UPDATE_WORKFLOW';
export const UPDATE_LAST_ERROR = 'donations/UPDATE_LAST_ERROR';

export type AddReceiptAction = ReadonlyDeep<{
  type: typeof ADD_RECEIPT;
  payload: { receipt: DonationReceipt };
}>;

export type SubmitDonationAction = ReadonlyDeep<{
  type: typeof SUBMIT_DONATION;
  payload: SubmitDonationType;
}>;

export type UpdateLastErrorAction = ReadonlyDeep<{
  type: typeof UPDATE_LAST_ERROR;
  payload: { lastError: DonationErrorType | undefined };
}>;

export type UpdateWorkflowAction = ReadonlyDeep<{
  type: typeof UPDATE_WORKFLOW;
  payload: { nextWorkflow: DonationWorkflow | undefined };
}>;

export type DonationsActionType = ReadonlyDeep<
  | AddReceiptAction
  | SubmitDonationAction
  | UpdateLastErrorAction
  | UpdateWorkflowAction
>;

// Action Creators

export function addReceipt(receipt: DonationReceipt): AddReceiptAction {
  return {
    type: ADD_RECEIPT,
    payload: { receipt },
  };
}

function internalAddDonationReceipt(
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

export type SubmitDonationType = ReadonlyDeep<{
  currencyType: string;
  paymentAmount: StripeDonationAmount;
  paymentDetail: CardDetail;
}>;

function submitDonation({
  currencyType,
  paymentAmount,
  paymentDetail,
}: SubmitDonationType): ThunkAction<
  void,
  RootStateType,
  unknown,
  UpdateWorkflowAction
> {
  return async () => {
    if (!isStagingServer()) {
      log.error('internalAddDonationReceipt: Only available on staging server');
      return;
    }

    try {
      await donations._internalDoDonation({
        currencyType,
        paymentAmount,
        paymentDetail,
      });
    } catch (error) {
      log.warn('submitDonation failed', Errors.toLogFormat(error));
    }
  };
}

function clearWorkflow(): UpdateWorkflowAction {
  return {
    type: UPDATE_WORKFLOW,
    payload: { nextWorkflow: undefined },
  };
}

function updateLastError(
  lastError: DonationErrorType | undefined
): UpdateLastErrorAction {
  return {
    type: UPDATE_LAST_ERROR,
    payload: { lastError },
  };
}

function updateWorkflow(
  nextWorkflow: DonationWorkflow | undefined
): UpdateWorkflowAction {
  return {
    type: UPDATE_WORKFLOW,
    payload: { nextWorkflow },
  };
}

export const actions = {
  addReceipt,
  clearWorkflow,
  internalAddDonationReceipt,
  submitDonation,
  updateLastError,
  updateWorkflow,
};

export const useDonationsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

// Reducer

export function getEmptyState(): DonationsStateType {
  return {
    currentWorkflow: undefined,
    lastError: undefined,
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

  if (action.type === UPDATE_LAST_ERROR) {
    return {
      ...state,
      lastError: action.payload.lastError,
    };
  }

  if (action.type === UPDATE_WORKFLOW) {
    return {
      ...state,
      currentWorkflow: action.payload.nextWorkflow,
    };
  }

  return state;
}
