// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { isInSystemContacts } from './isInSystemContacts.std.js';

export function getE164(
  attributes: Pick<
    ConversationAttributesType | ConversationType,
    | 'type'
    | 'name'
    | 'systemGivenName'
    | 'systemFamilyName'
    | 'e164'
    | 'sharingPhoneNumber'
    | 'profileKey'
  >
): string | undefined {
  const { e164, profileKey, sharingPhoneNumber } = attributes;

  if (!sharingPhoneNumber && profileKey && !isInSystemContacts(attributes)) {
    return undefined;
  }

  return e164;
}
