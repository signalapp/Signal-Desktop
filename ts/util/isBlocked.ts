// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';
import { isAciString } from './isAciString';

export function isBlocked(
  attributes: Pick<ConversationAttributesType, 'e164' | 'groupId' | 'serviceId'>
): boolean {
  const { e164, groupId, serviceId } = attributes;
  if (isAciString(serviceId)) {
    return window.storage.blocked.isServiceIdBlocked(serviceId);
  }

  if (e164) {
    return window.storage.blocked.isBlocked(e164);
  }

  if (groupId) {
    return window.storage.blocked.isGroupBlocked(groupId);
  }

  return false;
}
