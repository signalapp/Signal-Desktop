// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';
import { omit } from 'lodash';

import { generateSafetyNumber } from '../../util/safetyNumber';
import type { SafetyNumberType } from '../../types/safetyNumber';
import type { ConversationType } from './conversations';
import {
  reloadProfiles,
  toggleVerification,
} from '../../shims/contactVerification';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import type { StateType as RootStateType } from '../reducer';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

export type SafetyNumberContactType = ReadonlyDeep<{
  safetyNumber: SafetyNumberType;
  safetyNumberChanged?: boolean;
  verificationDisabled: boolean;
}>;

export type SafetyNumberStateType = ReadonlyDeep<{
  contacts: {
    [key: string]: SafetyNumberContactType;
  };
}>;

const CLEAR_SAFETY_NUMBER = 'safetyNumber/CLEAR_SAFETY_NUMBER';
const GENERATE_FULFILLED = 'safetyNumber/GENERATE_FULFILLED';
const TOGGLE_VERIFIED_FULFILLED = 'safetyNumber/TOGGLE_VERIFIED_FULFILLED';
const TOGGLE_VERIFIED_PENDING = 'safetyNumber/TOGGLE_VERIFIED_PENDING';

type ClearSafetyNumberActionType = ReadonlyDeep<{
  type: 'safetyNumber/CLEAR_SAFETY_NUMBER';
  payload: {
    contactId: string;
  };
}>;

type GenerateFulfilledActionType = ReadonlyDeep<{
  type: 'safetyNumber/GENERATE_FULFILLED';
  payload: {
    contact: ConversationType;
    safetyNumber: SafetyNumberType;
  };
}>;

type ToggleVerifiedPendingActionType = ReadonlyDeep<{
  type: 'safetyNumber/TOGGLE_VERIFIED_PENDING';
  payload: {
    contact: ConversationType;
  };
}>;

type ToggleVerifiedFulfilledActionType = ReadonlyDeep<{
  type: 'safetyNumber/TOGGLE_VERIFIED_FULFILLED';
  payload: {
    contact: ConversationType;
    safetyNumber?: SafetyNumberType;
    safetyNumberChanged?: boolean;
  };
}>;

export type SafetyNumberActionType = ReadonlyDeep<
  | ClearSafetyNumberActionType
  | GenerateFulfilledActionType
  | ToggleVerifiedPendingActionType
  | ToggleVerifiedFulfilledActionType
>;

function clearSafetyNumber(contactId: string): ClearSafetyNumberActionType {
  return {
    type: CLEAR_SAFETY_NUMBER,
    payload: { contactId },
  };
}

function generate(
  contact: ConversationType
): ThunkAction<void, RootStateType, unknown, GenerateFulfilledActionType> {
  return async dispatch => {
    try {
      const safetyNumber = await generateSafetyNumber(contact);
      dispatch({
        type: GENERATE_FULFILLED,
        payload: {
          contact,
          safetyNumber,
        },
      });
    } catch (error) {
      log.error(
        'failed to generate security number:',
        Errors.toLogFormat(error)
      );
    }
  };
}

function toggleVerified(
  contact: ConversationType
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ToggleVerifiedPendingActionType | ToggleVerifiedFulfilledActionType
> {
  return async dispatch => {
    dispatch({
      type: TOGGLE_VERIFIED_PENDING,
      payload: {
        contact,
      },
    });

    try {
      await alterVerification(contact);

      dispatch({
        type: TOGGLE_VERIFIED_FULFILLED,
        payload: {
          contact,
        },
      });
    } catch (err) {
      if (err.name === 'OutgoingIdentityKeyError') {
        await reloadProfiles(contact.id);
        const safetyNumber = await generateSafetyNumber(contact);

        dispatch({
          type: TOGGLE_VERIFIED_FULFILLED,
          payload: {
            contact,
            safetyNumber,
            safetyNumberChanged: true,
          },
        });
      }
    }
  };
}

async function alterVerification(contact: ConversationType): Promise<void> {
  try {
    await toggleVerification(contact.id);
  } catch (result) {
    if (result instanceof Error) {
      if (result.name === 'OutgoingIdentityKeyError') {
        throw result;
      } else {
        log.error('failed to toggle verified:', Errors.toLogFormat(result));
      }
    } else {
      const keyError = result.errors.find(
        (error: Error) => error.name === 'OutgoingIdentityKeyError'
      );
      if (keyError) {
        throw keyError;
      } else {
        result.errors.forEach((error: Error) => {
          log.error('failed to toggle verified:', Errors.toLogFormat(error));
        });
      }
    }
  }
}

export const actions = {
  clearSafetyNumber,
  generateSafetyNumber: generate,
  toggleVerified,
};

export const useSafetyNumberActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): SafetyNumberStateType {
  return {
    contacts: {},
  };
}

export function reducer(
  state: Readonly<SafetyNumberStateType> = getEmptyState(),
  action: Readonly<SafetyNumberActionType>
): SafetyNumberStateType {
  if (action.type === CLEAR_SAFETY_NUMBER) {
    const { contactId } = action.payload;
    return {
      contacts: omit(state.contacts, contactId),
    };
  }

  if (action.type === TOGGLE_VERIFIED_PENDING) {
    const { contact } = action.payload;
    const { id } = contact;
    const record = state.contacts[id];
    return {
      contacts: {
        ...state.contacts,
        [id]: {
          ...record,
          safetyNumberChanged: false,
          verificationDisabled: true,
        },
      },
    };
  }

  if (action.type === TOGGLE_VERIFIED_FULFILLED) {
    const { contact, ...restProps } = action.payload;
    const { id } = contact;
    const record = state.contacts[id];
    return {
      contacts: {
        ...state.contacts,
        [id]: {
          ...record,
          ...restProps,
          verificationDisabled: false,
        },
      },
    };
  }

  if (action.type === GENERATE_FULFILLED) {
    const { contact, safetyNumber } = action.payload;
    const { id } = contact;
    const record = state.contacts[id];
    return {
      contacts: {
        ...state.contacts,
        [id]: {
          ...record,
          safetyNumber,
        },
      },
    };
  }

  return state;
}
