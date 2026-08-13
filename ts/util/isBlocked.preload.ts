// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { isAciString } from './isAciString.std.ts';
import { isSignalServiceId } from '../types/SignalConversation.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

export function isBlocked(
  attributes: Pick<ConversationAttributesType, 'e164' | 'groupId' | 'serviceId'>
): boolean {
  const { e164, groupId, serviceId } = attributes;

  if (serviceId != null && isSignalServiceId(serviceId)) {
    return itemStorage.blocked.isReleaseNotesChatBlocked();
  }

  if (
    isAciString(serviceId) &&
    itemStorage.blocked.isServiceIdBlocked(serviceId)
  ) {
    return true;
  }

  if (e164 && itemStorage.blocked.isBlocked(e164)) {
    return true;
  }

  if (groupId && itemStorage.blocked.isGroupBlocked(groupId)) {
    return true;
  }

  return false;
}
