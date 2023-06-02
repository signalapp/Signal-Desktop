// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types';

export function isBlocked(attributes: ConversationAttributesType): boolean {
  const { e164, groupId, uuid } = attributes;
  if (uuid) {
    return window.storage.blocked.isUuidBlocked(uuid);
  }

  if (e164) {
    return window.storage.blocked.isBlocked(e164);
  }

  if (groupId) {
    return window.storage.blocked.isGroupBlocked(groupId);
  }

  return false;
}
