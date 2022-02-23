// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { generateSecurityNumberBlock } from '../../util/safetyNumber';
import type { ConversationType } from './conversations';
import {
  reloadProfiles,
  toggleVerification,
} from '../../shims/contactVerification';
import * as log from '../../logging/log';

export type SafetyNumberContactType = {
  safetyNumber: string;
  safetyNumberChanged?: boolean;
  verificationDisabled: boolean;
};

export type SafetyNumberStateType = {
  contacts: {
    [key: string]: SafetyNumberContactType;
  };
};

const GENERATE = 'safetyNumber/GENERATE';
const GENERATE_FULFILLED = 'safetyNumber/GENERATE_FULFILLED';
const TOGGLE_VERIFIED = 'safetyNumber/TOGGLE_VERIFIED';
const TOGGLE_VERIFIED_FULFILLED = 'safetyNumber/TOGGLE_VERIFIED_FULFILLED';
const TOGGLE_VERIFIED_PENDING = 'safetyNumber/TOGGLE_VERIFIED_PENDING';

type GenerateAsyncActionType = {
  contact: ConversationType;
  safetyNumber: string;
};

type GenerateActionType = {
  type: 'safetyNumber/GENERATE';
  payload: Promise<GenerateAsyncActionType>;
};

type GenerateFulfilledActionType = {
  type: 'safetyNumber/GENERATE_FULFILLED';
  payload: GenerateAsyncActionType;
};

type ToggleVerifiedAsyncActionType = {
  contact: ConversationType;
  safetyNumber?: string;
  safetyNumberChanged?: boolean;
};

type ToggleVerifiedActionType = {
  type: 'safetyNumber/TOGGLE_VERIFIED';
  payload: {
    data: { contact: ConversationType };
    promise: Promise<ToggleVerifiedAsyncActionType>;
  };
};

type ToggleVerifiedPendingActionType = {
  type: 'safetyNumber/TOGGLE_VERIFIED_PENDING';
  payload: ToggleVerifiedAsyncActionType;
};

type ToggleVerifiedFulfilledActionType = {
  type: 'safetyNumber/TOGGLE_VERIFIED_FULFILLED';
  payload: ToggleVerifiedAsyncActionType;
};

export type SafetyNumberActionType =
  | GenerateActionType
  | GenerateFulfilledActionType
  | ToggleVerifiedActionType
  | ToggleVerifiedPendingActionType
  | ToggleVerifiedFulfilledActionType;

function generate(contact: ConversationType): GenerateActionType {
  return {
    type: GENERATE,
    payload: doGenerate(contact),
  };
}

async function doGenerate(
  contact: ConversationType
): Promise<GenerateAsyncActionType> {
  const securityNumberBlock = await generateSecurityNumberBlock(contact);
  return {
    contact,
    safetyNumber: securityNumberBlock.join(' '),
  };
}

function toggleVerified(contact: ConversationType): ToggleVerifiedActionType {
  return {
    type: TOGGLE_VERIFIED,
    payload: {
      data: { contact },
      promise: doToggleVerified(contact),
    },
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
        log.error(
          'failed to toggle verified:',
          result && result.stack ? result.stack : result
        );
      }
    } else {
      const keyError = result.errors.find(
        (error: Error) => error.name === 'OutgoingIdentityKeyError'
      );
      if (keyError) {
        throw keyError;
      } else {
        result.errors.forEach((error: Error) => {
          log.error(
            'failed to toggle verified:',
            error && error.stack ? error.stack : error
          );
        });
      }
    }
  }
}

async function doToggleVerified(
  contact: ConversationType
): Promise<ToggleVerifiedAsyncActionType> {
  try {
    await alterVerification(contact);
  } catch (err) {
    if (err.name === 'OutgoingIdentityKeyError') {
      await reloadProfiles(contact.id);
      const securityNumberBlock = await generateSecurityNumberBlock(contact);

      return {
        contact,
        safetyNumber: securityNumberBlock.join(' '),
        safetyNumberChanged: true,
      };
    }
  }

  return { contact };
}

export const actions = {
  generateSafetyNumber: generate,
  toggleVerified,
};

export function getEmptyState(): SafetyNumberStateType {
  return {
    contacts: {},
  };
}

export function reducer(
  state: Readonly<SafetyNumberStateType> = getEmptyState(),
  action: Readonly<SafetyNumberActionType>
): SafetyNumberStateType {
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
