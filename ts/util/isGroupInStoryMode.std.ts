// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { StorySendMode } from '../types/Stories.std.js';
import { assertDev } from './assert.std.js';

export function isGroupInStoryMode(
  { id, type, storySendMode }: ConversationType,
  conversationIdsWithStories: Set<string>
): boolean {
  if (type !== 'group') {
    return false;
  }
  assertDev(
    storySendMode !== undefined,
    'isGroupInStoryMode: groups must have storySendMode field'
  );
  if (storySendMode === StorySendMode.IfActive) {
    return conversationIdsWithStories.has(id);
  }
  return storySendMode === StorySendMode.Always;
}
