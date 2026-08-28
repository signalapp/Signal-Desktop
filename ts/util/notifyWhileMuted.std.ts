// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.ts';

/**
 * Which notifications still come through while a chat is muted.
 */
export type NotifyWhileMuted = Readonly<{
  calls: boolean;
  mentions: boolean;
  replies: boolean;
}>;

export type NotifyWhileMutedKey = keyof NotifyWhileMuted;

export const DEFAULT_NOTIFY_IF_MUTED: NotifyWhileMuted = {
  calls: false,
  mentions: true,
  replies: true,
};

export type NotifyWhileMutedFields = Readonly<{
  notifyForCallsIfMuted?: boolean | undefined;
  notifyForMentionsIfMuted?: boolean | undefined;
  notifyForRepliesIfMuted?: boolean | undefined;
}>;

export const NOTIFY_WHILE_MUTED_FIELDS = {
  calls: 'notifyForCallsIfMuted',
  mentions: 'notifyForMentionsIfMuted',
  replies: 'notifyForRepliesIfMuted',
} as const satisfies Record<NotifyWhileMutedKey, keyof NotifyWhileMutedFields>;

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
  conversation: NotifyWhileMutedFields,
  globalNotifyWhileMuted: NotifyWhileMuted
): NotifyWhileMuted {
  return {
    calls: conversation.notifyForCallsIfMuted ?? globalNotifyWhileMuted.calls,
    mentions:
      conversation.notifyForMentionsIfMuted ?? globalNotifyWhileMuted.mentions,
    replies:
      conversation.notifyForRepliesIfMuted ?? globalNotifyWhileMuted.replies,
  };
}

export function getNotifyWhileMutedSummary(
  { calls, mentions, replies }: NotifyWhileMuted,
  i18n: LocalizerType
): string {
  if (calls && mentions && replies) {
    return i18n('icu:WhileMuted__value--calls-mentions-replies');
  }
  if (calls && mentions) {
    return i18n('icu:WhileMuted__value--calls-mentions');
  }
  if (calls && replies) {
    return i18n('icu:WhileMuted__value--calls-replies');
  }
  if (mentions && replies) {
    return i18n('icu:WhileMuted__value--mentions-replies');
  }
  if (calls) {
    return i18n('icu:WhileMuted__value--calls');
  }
  if (mentions) {
    return i18n('icu:WhileMuted__value--mentions');
  }
  if (replies) {
    return i18n('icu:WhileMuted__value--replies');
  }

  return i18n('icu:WhileMuted__value--none');
}
