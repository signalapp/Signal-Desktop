// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { useBoundActions } from '../../hooks/useBoundActions.std.js';
import { createLogger } from '../../logging/log.std.js';
import * as Errors from '../../types/errors.std.js';
import { isStagingServer } from '../../util/isStagingServer.dom.js';
import { DataWriter } from '../../sql/Client.preload.js';
import * as donations from '../../services/donations.preload.js';
import { donationStateSchema } from '../../types/Donations.std.js';
import { drop } from '../../util/drop.std.js';
import { storageServiceUploadJob } from '../../services/storage.preload.js';
import { getMe } from '../selectors/conversations.dom.js';
import { actions as conversationActions } from './conversations.preload.js';
import type {
  ProfileDataType,
  SetProfileUpdateErrorActionType,
} from './conversations.preload.js';

import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import type {
  CardDetail,
  DonationErrorType,
  DonationReceipt,
  DonationWorkflow,
  StripeDonationAmount,
} from '../../types/Donations.std.js';
import type { BadgeType } from '../../badges/types.std.js';
import type { StateType as RootStateType } from '../reducer.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

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
  UpdateWorkflowAction | UpdateLastErrorAction
> {
  return async (dispatch, getState) => {
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
      log.error('submitDonation failed', Errors.toLogFormat(error));
      dispatch({
        type: UPDATE_LAST_ERROR,
        payload: { lastError: 'GeneralError' },
      });
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

export function applyDonationBadge({
  badge,
  applyBadge,
  onComplete,
  storage = itemStorage,
}: {
  badge: BadgeType | undefined;
  applyBadge: boolean;
  onComplete: (error?: Error) => void;

  // Only for testing
  storage?: Pick<typeof itemStorage, 'get' | 'put'>;
}): ThunkAction<void, RootStateType, unknown, SetProfileUpdateErrorActionType> {
  return async (dispatch, getState) => {
    const me = getMe(getState());

    if (!badge) {
      onComplete(new Error('No badge was given to redeem'));
      return;
    }

    const allBadgesHaveVisibilityData = me.badges.every(
      myBadge => 'isVisible' in myBadge
    );

    const desiredBadgeIndexInUserBadges = me.badges.findIndex(
      myBadge => myBadge.id === badge.id
    );

    const userHasDesiredBadgeToApply = desiredBadgeIndexInUserBadges !== -1;
    const desiredBadgeInUserProfile =
      me.badges?.[desiredBadgeIndexInUserBadges];

    if (!userHasDesiredBadgeToApply || !desiredBadgeInUserProfile) {
      onComplete(new Error('User does not have the desired badge to apply'));
      return;
    }

    if (
      !allBadgesHaveVisibilityData ||
      !('isVisible' in desiredBadgeInUserProfile)
    ) {
      onComplete(
        new Error("Unable to determine user's existing visible badges")
      );
      return;
    }

    const previousDisplayBadgesOnProfile =
      me.badges.length > 0 &&
      me.badges.every(myBadge => 'isVisible' in myBadge && myBadge.isVisible);

    const otherBadges = me.badges?.filter(b => b.id !== badge.id) ?? [];

    let newDisplayBadgesOnProfile = previousDisplayBadgesOnProfile;

    if (applyBadge) {
      // Add the badge to the front and make ALL badges visible
      const updatedBadges = [
        { id: badge.id, isVisible: true },
        ...otherBadges.map(b => ({ ...b, isVisible: true })),
      ];

      // Note: We pass only the badges we want visible to myProfileChanged.
      // This is how the API works - we're not "deleting" invisible badges,
      // we're setting the complete list of visible badges.
      const profileData: ProfileDataType = {
        badges: updatedBadges,
      };

      await dispatch(
        conversationActions.myProfileChanged(profileData, { keepAvatar: true })
      );
      newDisplayBadgesOnProfile = true;
    } else if (
      // If we're here, the user has unchecked the setting to apply the badge.
      // If the badge we want to apply is already the primary visible badge, we
      // disable showing badges.
      // If the user has another badge as primary, we do nothing and keep it.
      desiredBadgeIndexInUserBadges === 0 &&
      desiredBadgeInUserProfile.isVisible
    ) {
      const profileData: ProfileDataType = {
        badges: [],
      };

      await dispatch(
        conversationActions.myProfileChanged(profileData, { keepAvatar: true })
      );
      newDisplayBadgesOnProfile = false;
    }

    const storageValue = storage.get('displayBadgesOnProfile');
    if (
      storageValue == null ||
      previousDisplayBadgesOnProfile !== newDisplayBadgesOnProfile
    ) {
      await storage.put('displayBadgesOnProfile', newDisplayBadgesOnProfile);
      if (previousDisplayBadgesOnProfile !== newDisplayBadgesOnProfile) {
        storageServiceUploadJob({ reason: 'donation-badge-toggle' });
      }
    }

    onComplete();
  };
}

export const actions = {
  addReceipt,
  applyDonationBadge,
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
