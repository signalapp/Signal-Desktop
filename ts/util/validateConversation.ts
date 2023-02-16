// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ValidateConversationType } from '../model-types.d';
import { isDirectConversation } from './whatTypeOfConversation';
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
  const { e164 } = attributes;
  if (isDirectConversation(attributes) && e164) {
    if (!/^\+[1-9][0-9]{0,18}$/.test(e164)) {
      return 'Invalid E164';
    }

    return null;
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
