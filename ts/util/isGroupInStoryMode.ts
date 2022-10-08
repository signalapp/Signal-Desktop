// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';
import { StorySendMode } from '../types/Stories';
import { assertDev } from './assert';

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
