// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from './isInSystemContacts';

export function getE164(
  attributes: Pick<
    ConversationAttributesType | ConversationType,
    | 'type'
    | 'name'
    | 'systemGivenName'
    | 'systemFamilyName'
    | 'e164'
    | 'notSharingPhoneNumber'
  >
): string | undefined {
  const { e164, notSharingPhoneNumber = false } = attributes;

  if (notSharingPhoneNumber && !isInSystemContacts(attributes)) {
    return undefined;
  }

  return e164;
}
