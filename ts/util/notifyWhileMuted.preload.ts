// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import type { NotifyWhileMuted } from './notifyWhileMuted.std.ts';
import {
  DEFAULT_NOTIFY_IF_MUTED,
  getNotifyWhileMuted,
} from './notifyWhileMuted.std.ts';

function getGlobalNotifyWhileMutedFromStorage(): NotifyWhileMuted {
  return {
    calls: itemStorage.get(
      'notifyForCallsIfMuted',
      DEFAULT_NOTIFY_IF_MUTED.calls
    ),
    mentions: itemStorage.get(
      'notifyForMentionsIfMuted',
      DEFAULT_NOTIFY_IF_MUTED.mentions
    ),
    replies: itemStorage.get(
      'notifyForRepliesIfMuted',
      DEFAULT_NOTIFY_IF_MUTED.replies
    ),
  };
}

export function getNotifyWhileMutedForConversation(
  attributes: ConversationAttributesType
): NotifyWhileMuted {
  return getNotifyWhileMuted(
    attributes,
    getGlobalNotifyWhileMutedFromStorage()
  );
}
