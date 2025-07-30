// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { useBoundActions } from '../../hooks/useBoundActions';
import { createLogger } from '../../logging/log';
import * as Errors from '../../types/errors';
import { isStagingServer } from '../../util/isStagingServer';
import { DataWriter } from '../../sql/Client';
import * as donations from '../../services/donations';
import { donationStateSchema } from '../../types/Donations';
import { drop } from '../../util/drop';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type {
  CardDetail,
  DonationErrorType,
  DonationReceipt,
  DonationWorkflow,
  StripeDonationAmount,
} from '../../types/Donations';
import type { StateType as RootStateType } from '../reducer';

const log = createLogger('donations');

// State

export type DonationsStateType = ReadonlyDeep<{
  currentWorkflow: DonationWorkflow | undefined;
  didResumeWorkflowAtStartup: boolean;
  lastError: DonationErrorType | undefined;
  receipts: Array<DonationReceipt>;
}>;

// Actions

export const ADD_RECEIPT = 'donations/ADD_RECEIPT';
export const SUBMIT_DONATION = 'donations/SUBMIT_DONATION';
export const UPDATE_WORKFLOW = 'donations/UPDATE_WORKFLOW';
export const UPDATE_LAST_ERROR = 'donations/UPDATE_LAST_ERROR';
export const SET_DID_RESUME = 'donations/SET_DID_RESUME';

export type AddReceiptAction = ReadonlyDeep<{
  type: typeof ADD_RECEIPT;
  payload: { receipt: DonationReceipt };
}>;

export type SetDidResumeAction = ReadonlyDeep<{
  type: typeof SET_DID_RESUME;
  payload: boolean;
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
  | SetDidResumeAction
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

function setDidResume(didResume: boolean): SetDidResumeAction {
  return {
    type: SET_DID_RESUME,
    payload: didResume,
  };
}

function resumeWorkflow(): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetDidResumeAction
> {
  return async dispatch => {
    try {
      dispatch({
        type: SET_DID_RESUME,
        payload: false,
      });

      await donations.resumeDonation();
    } catch (error) {
      log.error('Error resuming workflow', Errors.toLogFormat(error));
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
  return async (_dispatch, getState) => {
    if (!isStagingServer()) {
      log.error('submitDonation: Only available on staging server');
      return;
    }

    try {
      const { currentWorkflow } = getState().donations;
      if (
        currentWorkflow?.type === donationStateSchema.Enum.INTENT &&
        currentWorkflow.paymentAmount === paymentAmount &&
        currentWorkflow.currencyType === currencyType
      ) {
        // we can proceed without starting afresh
      } else {
        await donations.clearDonation();
        await donations.startDonation({
          currencyType,
          paymentAmount,
        });
      }

      await donations.finishDonationWithCard(paymentDetail);
    } catch (error) {
      log.warn('submitDonation failed', Errors.toLogFormat(error));
    }
  };
}

function clearWorkflow(): UpdateWorkflowAction {
  drop(donations.clearDonation());

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
  setDidResume,
  resumeWorkflow,
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
    didResumeWorkflowAtStartup: false,
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

  if (action.type === SET_DID_RESUME) {
    return {
      ...state,
      didResumeWorkflowAtStartup: action.payload,
    };
  }

  if (action.type === UPDATE_LAST_ERROR) {
    return {
      ...state,
      lastError: action.payload.lastError,
    };
  }

  if (action.type === UPDATE_WORKFLOW) {
    const { nextWorkflow } = action.payload;

    // If we've cleared the workflow or are starting afresh, we clear the startup flag
    const didResumeWorkflowAtStartup =
      !nextWorkflow || nextWorkflow.type === donationStateSchema.Enum.INTENT
        ? false
        : state.didResumeWorkflowAtStartup;

    return {
      ...state,
      didResumeWorkflowAtStartup,
      currentWorkflow: nextWorkflow,
    };
  }

  return state;
}
