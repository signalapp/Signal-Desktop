// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { isConversationMuted } from './isConversationMuted';

export function canConversationBeUnarchived(
  attrs: ConversationAttributesType
): boolean {
  if (!attrs.isArchived) {
    return false;
  }

  if (!isConversationMuted(attrs)) {
    return true;
  }

  if (window.storage.get('keepMutedChatsArchived') ?? false) {
    return false;
  }

  return true;
}
