// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

/**
 * Which notifications still come through while a chat is muted.
 */
export type NotifyWhileMuted = Readonly<{
  calls: boolean;
  mentions: boolean;
  replies: boolean;
}>;

export type NotifyWhileMutedKey = keyof NotifyWhileMuted;

export const DEFAULT_NOTIFY_WHILE_MUTED: NotifyWhileMuted = {
  calls: true,
  mentions: true,
  replies: true,
};

type NotifyWhileMutedFields = Readonly<
  Pick<
    ConversationAttributesType,
    | 'notifyForCallsIfMuted'
    | 'notifyForMentionsIfMuted'
    | 'notifyForRepliesIfMuted'
  >
>;

/**
 * Reconciles an incoming record's deprecated `dontNotifyForMentionsIfMuted`
 * with its replacement, for both storage service and backups.
 */
export function resolveLegacyNotifyForMentionsIfMuted(
  dontNotifyForMentionsIfMuted: boolean,
  notifyForMentionsIfMuted: boolean | undefined
): { notifyForMentionsIfMuted: boolean | undefined } {
  // Old field is explicitly set to true (don't notify), so it wins even if the new field
  // disagrees.
  if (dontNotifyForMentionsIfMuted) {
    return { notifyForMentionsIfMuted: false };
  }

  // Old field is unset (notify) & new field is unset, so keep it unset
  if (notifyForMentionsIfMuted == null) {
    return { notifyForMentionsIfMuted: undefined };
  }

  // Old field is unset (notify), and the new field is either explicitly true
  // (agreement) or explicitly false (an old client just re-enabled mentions and
  // round-tripped our stale value). We should set explicitly true to notify.
  return { notifyForMentionsIfMuted: true };
}

export function getNotifyWhileMuted(
  fields: NotifyWhileMutedFields
): NotifyWhileMuted {
  return {
    calls: fields.notifyForCallsIfMuted ?? DEFAULT_NOTIFY_WHILE_MUTED.calls,
    mentions:
      fields.notifyForMentionsIfMuted ?? DEFAULT_NOTIFY_WHILE_MUTED.mentions,
    replies:
      fields.notifyForRepliesIfMuted ?? DEFAULT_NOTIFY_WHILE_MUTED.replies,
  };
}
