// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ValidateConversationType } from '../model-types.d';
import { isDirectConversation } from './whatTypeOfConversation';
import { parseNumber } from './libphonenumberUtil';
import { isValidUuid } from '../types/UUID';

export function validateConversation(
  attributes: ValidateConversationType
): string | null {
  if (attributes.type !== 'private' && attributes.type !== 'group') {
    return `Invalid conversation type: ${attributes.type}`;
  }

  if (!attributes.e164 && !attributes.uuid && !attributes.groupId) {
    return 'Missing one of e164, uuid, or groupId';
  }

  const error = validateNumber(attributes) || validateUuid(attributes);

  if (error) {
    return error;
  }

  return null;
}

function validateNumber(attributes: ValidateConversationType): string | null {
  if (isDirectConversation(attributes) && attributes.e164) {
    const regionCode = window.storage.get('regionCode');
    if (!regionCode) {
      throw new Error('No region code');
    }
    const number = parseNumber(attributes.e164, regionCode);
    if (number.isValidNumber) {
      return null;
    }

    let errorMessage: undefined | string;
    if (number.error instanceof Error) {
      errorMessage = number.error.message;
    } else if (typeof number.error === 'string') {
      errorMessage = number.error;
    }
    return errorMessage || 'Invalid phone number';
  }

  return null;
}

function validateUuid(attributes: ValidateConversationType): string | null {
  if (isDirectConversation(attributes) && attributes.uuid) {
    if (isValidUuid(attributes.uuid)) {
      return null;
    }

    return 'Invalid UUID';
  }

  return null;
}
