// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ValidateConversationType } from '../model-types.d.ts';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from './whatTypeOfConversation.dom.js';
import { isServiceIdString } from '../types/ServiceId.std.js';

export function validateConversation(
  attributes: ValidateConversationType
): string | null {
  if (attributes.type !== 'private' && attributes.type !== 'group') {
    return `Invalid conversation type: ${attributes.type}`;
  }

  if (!attributes.e164 && !attributes.serviceId && !attributes.groupId) {
    return 'Missing one of e164, serviceId, or groupId';
  }

  const error = validateNumber(attributes) || validateServiceId(attributes);

  if (error) {
    return error;
  }

  if (
    !isDirectConversation(attributes) &&
    !isGroupV1(attributes) &&
    !isGroupV2(attributes)
  ) {
    return 'Conversation is not direct, groupv1 or groupv2';
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

function validateServiceId(
  attributes: ValidateConversationType
): string | null {
  if (isDirectConversation(attributes) && attributes.serviceId) {
    if (isServiceIdString(attributes.serviceId)) {
      return null;
    }

    return 'Invalid ServiceId';
  }

  return null;
}
