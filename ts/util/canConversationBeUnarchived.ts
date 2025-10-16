// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { isConversationMuted } from './isConversationMuted.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function canConversationBeUnarchived(
  attrs: ConversationAttributesType
): boolean {
  if (!attrs.isArchived) {
    return false;
  }

  if (!isConversationMuted(attrs)) {
    return true;
  }

  if (itemStorage.get('keepMutedChatsArchived') ?? false) {
    return false;
  }

  return true;
}
