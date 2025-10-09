// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.js';
import { isAciString } from './isAciString.js';
import { itemStorage } from '../textsecure/Storage.js';

export function isBlocked(
  attributes: Pick<ConversationAttributesType, 'e164' | 'groupId' | 'serviceId'>
): boolean {
  const { e164, groupId, serviceId } = attributes;
  if (isAciString(serviceId)) {
    return itemStorage.blocked.isServiceIdBlocked(serviceId);
  }

  if (e164) {
    return itemStorage.blocked.isBlocked(e164);
  }

  if (groupId) {
    return itemStorage.blocked.isGroupBlocked(groupId);
  }

  return false;
}
