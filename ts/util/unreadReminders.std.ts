// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { StorageInterface } from '../types/Storage.d.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { DAY, HOUR } from './durations/index.std.ts';

const log = createLogger('unreadReminders');

/** How long a chat must sit on unreminded activity before it may be elibigle for a reminder */
export const UNREAD_REMINDER_MIN_UNREAD_AGE = 3 * DAY;

/** How long must pass before a subsequent unread reminder is sent for a conversation */
export const UNREAD_REMINDER_MIN_INTERVAL_BETWEEN_REMINDERS = 3 * DAY;

/** Never remind about a chat whose newest unread is older than this */
export const UNREAD_REMINDER_MAX_AGE = 14 * DAY;

/** How often the app will check for unread reminders */
export const UNREAD_REMINDER_POLL_INTERVAL = HOUR;

export const DEFAULT_SHOW_UNREAD_REMINDERS = true;

export function getShowUnreadRemindersForConversation(
  conversation: ConversationAttributesType,
  itemStorage: StorageInterface
): boolean {
  return getShowUnreadReminders(
    conversation,
    itemStorage.get('showUnreadReminders', DEFAULT_SHOW_UNREAD_REMINDERS)
  );
}

export function getShowUnreadReminders(
  conversation: { showUnreadReminders?: boolean | undefined },
  globalShowUnreadReminders: boolean
): boolean {
  return conversation.showUnreadReminders ?? globalShowUnreadReminders;
}

export type UnreadReminderCandidate = Readonly<{
  conversationId: string;
  oldestUnremindedReceivedAtMs: number;
  newestUnreadReceivedAtMs: number;
}>;

export function filterForConversationsDueReminder(
  candidates: ReadonlyArray<UnreadReminderCandidate>,
  now: number
): ReadonlyArray<string> {
  return candidates
    .filter(
      candidate =>
        candidate.newestUnreadReceivedAtMs > now - UNREAD_REMINDER_MAX_AGE
    )

    .filter(
      ({ oldestUnremindedReceivedAtMs }) =>
        oldestUnremindedReceivedAtMs < now - UNREAD_REMINDER_MIN_UNREAD_AGE
    )
    .sort(
      (a, b) => a.oldestUnremindedReceivedAtMs - b.oldestUnremindedReceivedAtMs
    )
    .map(({ conversationId }) => conversationId);
}

export type UnreadReminderParticipant = Readonly<{
  title: string;
}>;

export type UnreadReminderSummary = Readonly<{
  conversationId: string;
  conversationTitle: string;

  /** Total unread incoming messages. Mentions and replies are subsets of this. */
  unreadMessageCount: number;

  /** Zeroed when the chat's "while muted" setting for mentions is off. */
  mentionCount: number;
  /** Zeroed when the chat's "while muted" setting for replies is off. */
  replyCount: number;

  /** Most-recent-first, deduped */
  senders: ReadonlyArray<UnreadReminderParticipant>;
  /** Most-recent-first, deduped */
  mentioners: ReadonlyArray<UnreadReminderParticipant>;
  /** Most-recent-first, deduped*/
  repliers: ReadonlyArray<UnreadReminderParticipant>;
}>;

function getMentionSummary(
  mentionCount: number,
  mentioners: ReadonlyArray<UnreadReminderParticipant>,
  i18n: LocalizerType
): string | undefined {
  const person1 = mentioners[0]?.title;
  const person2 = mentioners[1]?.title;
  const person3 = mentioners[2]?.title;

  if (person1 && person2 && person3) {
    return i18n('icu:UnreadReminders__notification__mentionSummary--many', {
      mentionCount,
      person1,
    });
  }
  if (person1 && person2) {
    return i18n('icu:UnreadReminders__notification__mentionSummary--2', {
      mentionCount,
      person1,
      person2,
    });
  }
  if (person1) {
    return i18n('icu:UnreadReminders__notification__mentionSummary--1', {
      mentionCount,
      person1,
    });
  }
  log.error('Mentioners had no names', { mentionerCount: mentioners.length });
  return undefined;
}

function getReplySummary(
  replyCount: number,
  repliers: ReadonlyArray<UnreadReminderParticipant>,
  i18n: LocalizerType
): string | undefined {
  const person1 = repliers[0]?.title;
  const person2 = repliers[1]?.title;
  const person3 = repliers[2]?.title;

  if (person1 && person2 && person3) {
    return i18n('icu:UnreadReminders__notification__replySummary--many', {
      replyCount,
      person1,
    });
  }
  if (person1 && person2) {
    return i18n('icu:UnreadReminders__notification__replySummary--2', {
      replyCount,
      person1,
      person2,
    });
  }
  if (person1) {
    return i18n('icu:UnreadReminders__notification__replySummary--1', {
      replyCount,
      person1,
    });
  }
  log.error('Repliers had no names', { replierCount: repliers.length });
  return undefined;
}

function getCountsOnlyBody(messageCount: number, i18n: LocalizerType): string {
  return i18n('icu:UnreadReminders__notification--counts--messages', {
    messageCount,
  });
}

function getSendersBody(
  messageCount: number,
  senders: ReadonlyArray<UnreadReminderParticipant>,
  i18n: LocalizerType
): string | undefined {
  const person1 = senders[0]?.title;
  const person2 = senders[1]?.title;
  const person3 = senders[2]?.title;

  if (person1 && person2 && person3) {
    return i18n('icu:UnreadReminders__notification--messages--many', {
      messageCount,
      person1,
      person2,
    });
  }
  if (person1 && person2) {
    return i18n('icu:UnreadReminders__notification--messages--2', {
      messageCount,
      person1,
      person2,
    });
  }
  if (person1) {
    return i18n('icu:UnreadReminders__notification--messages--1', {
      messageCount,
      person1,
    });
  }

  log.error('No body generated', { senderCount: senders.length });
  return undefined;
}

export function getUnreadReminderNotificationContent({
  summary,
  contentSetting,
  fallbackTitle,
  i18n,
}: {
  summary: UnreadReminderSummary;
  contentSetting: 'countsOnly' | 'full';
  fallbackTitle: string;
  i18n: LocalizerType;
}): { title: string; body: string } {
  const {
    conversationTitle,
    unreadMessageCount,
    mentionCount,
    replyCount,
    senders,
    mentioners,
    repliers,
  } = summary;

  if (contentSetting === 'countsOnly') {
    const body = getCountsOnlyBody(unreadMessageCount, i18n);
    return { title: fallbackTitle, body };
  }

  const title = conversationTitle || fallbackTitle;

  const mentionSummary =
    mentionCount > 0
      ? getMentionSummary(mentionCount, mentioners, i18n)
      : undefined;
  const replySummary =
    replyCount > 0 ? getReplySummary(replyCount, repliers, i18n) : undefined;

  let body: string | undefined;
  // We prefer the mentionSummary to the reply summary
  if (mentionSummary != null) {
    body = i18n(
      'icu:UnreadReminders__notification--messages-including-mentions',
      {
        messageCount: unreadMessageCount,
        mentionSummary,
      }
    );
  } else if (replySummary != null) {
    body = i18n(
      'icu:UnreadReminders__notification--messages-including-replies',
      {
        messageCount: unreadMessageCount,
        replySummary,
      }
    );
  } else {
    body = getSendersBody(unreadMessageCount, senders, i18n);
    if (body == null) {
      body = getCountsOnlyBody(unreadMessageCount, i18n);
    }
  }

  return { title, body };
}
