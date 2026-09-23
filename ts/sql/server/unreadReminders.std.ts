// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import type { ReadableDB } from '../Interface.std.ts';
import type { QueryFragment, QueryTemplate } from '../util.std.ts';
import {
  batchMultiVarQuery,
  sql,
  sqlConstant,
  sqlFragment,
  sqlJoin,
} from '../util.std.ts';

const MAX_SENDERS_TO_SHOW = 5;

function storyIdPredicate(includeStoryReplies: boolean): QueryFragment {
  return includeStoryReplies
    ? sqlFragment`NULL IS NULL`
    : sqlFragment`storyId IS NULL`;
}

export type UnreadReminderConversationCandidate = Readonly<{
  conversationId: string;
  lastRemindedAt: number | null;
  includeStoryReplies: boolean;
}>;

export type UnreadMessageTimeRange = Readonly<{
  conversationId: string;
  oldestUnremindedReceivedAtMs: number;
  newestUnreadReceivedAtMs: number;
}>;

function cutoffsCte(
  batch: ReadonlyArray<UnreadReminderConversationCandidate>
): QueryFragment {
  return sqlJoin(
    batch.map(
      ({ conversationId, lastRemindedAt, includeStoryReplies }) =>
        sqlFragment`(${conversationId}, ${lastRemindedAt}, ${includeStoryReplies ? 1 : 0})`
    )
  );
}

export function getUnremindedUnreadMessageTimeRangesQuery(
  batch: ReadonlyArray<UnreadReminderConversationCandidate>
): QueryTemplate {
  return sql`
    WITH cutoffs(conversationId, lastRemindedAt, includeStoryReplies) AS (
      VALUES ${cutoffsCte(batch)}
    )
    SELECT
      messages.conversationId AS conversationId,
      MIN(messages.received_at_ms) AS oldestUnremindedReceivedAtMs,
      MAX(messages.received_at_ms) AS newestUnreadReceivedAtMs
    FROM messages
    INNER JOIN cutoffs ON cutoffs.conversationId IS messages.conversationId
    WHERE
      messages.readStatus = ${sqlConstant(ReadStatus.Unread)} AND
      messages.isStory IS 0 AND
      (cutoffs.includeStoryReplies IS 1 OR messages.storyId IS NULL) AND
      messages.received_at_ms > IFNULL(cutoffs.lastRemindedAt, 0)
    GROUP BY messages.conversationId
  `;
}

export function getUnremindedUnreadMessageTimeRanges(
  db: ReadableDB,
  conversations: ReadonlyArray<UnreadReminderConversationCandidate>
): ReadonlyArray<UnreadMessageTimeRange> {
  return batchMultiVarQuery(db, conversations, (batch, persistent) => {
    const [query, params] = getUnremindedUnreadMessageTimeRangesQuery(batch);

    return db
      .prepare(query, { persistent })
      .all<UnreadMessageTimeRange>(params);
  });
}

export type UnreadReminderSummaryData = Readonly<{
  unreadMessageCount: number;
  mentionCount: number;
  replyCount: number;
  senders: ReadonlyArray<{ sourceServiceId: string }>;
  mentioners: ReadonlyArray<{ sourceServiceId: string }>;
  repliers: ReadonlyArray<{ sourceServiceId: string }>;
}>;

export type UnreadReminderSummaryOptions = Readonly<{
  includeStoryReplies: boolean;
  ourAci: AciString;
}>;

export type UnreadReminderFilter = 'all' | 'mentions' | 'replies';

function unreadPredicate(
  conversationId: string,
  filter: UnreadReminderFilter,
  { includeStoryReplies, ourAci }: UnreadReminderSummaryOptions
): QueryFragment {
  let filterPredicate: QueryFragment;
  if (filter === 'mentions') {
    filterPredicate = sqlFragment`mentionsMe IS 1`;
  } else if (filter === 'replies') {
    filterPredicate = sqlFragment`json ->> '$.quote.authorAci' IS ${ourAci}`;
  } else {
    filterPredicate = sqlFragment`TRUE`;
  }

  return sqlFragment`
    conversationId = ${conversationId} AND
    readStatus = ${sqlConstant(ReadStatus.Unread)} AND
    isStory IS 0 AND
    (${storyIdPredicate(includeStoryReplies)}) AND
    (${filterPredicate})
  `;
}

export function getUnreadReminderCountQuery(
  conversationId: string,
  filter: UnreadReminderFilter,
  options: UnreadReminderSummaryOptions
): QueryTemplate {
  return sql`
    SELECT count(1) FROM messages
    WHERE ${unreadPredicate(conversationId, filter, options)}
  `;
}

export function getUnreadReminderSendersQuery(
  conversationId: string,
  filter: UnreadReminderFilter,
  options: UnreadReminderSummaryOptions
): QueryTemplate {
  return sql`
    SELECT
      sourceServiceId,
      MAX(received_at_ms) AS latestReceivedAtMs
    FROM messages
    WHERE
      sourceServiceId IS NOT NULL AND
      ${unreadPredicate(conversationId, filter, options)}
    GROUP BY sourceServiceId
    ORDER BY latestReceivedAtMs DESC
    LIMIT ${MAX_SENDERS_TO_SHOW}
  `;
}

export function getUnreadReminderSummaryData(
  db: ReadableDB,
  conversationId: string,
  options: UnreadReminderSummaryOptions
): UnreadReminderSummaryData {
  return db.transaction(() => {
    const countUnread = (filter: UnreadReminderFilter) => {
      const [query, params] = getUnreadReminderCountQuery(
        conversationId,
        filter,
        options
      );
      return db.prepare(query, { pluck: true }).get<number>(params) ?? 0;
    };

    const getSenders = (filter: UnreadReminderFilter) => {
      const [query, params] = getUnreadReminderSendersQuery(
        conversationId,
        filter,
        options
      );
      return db.prepare(query).all<{
        sourceServiceId: string;
      }>(params);
    };

    const unreadMessageCount = countUnread('all');
    const mentionCount = countUnread('mentions');
    const replyCount = countUnread('replies');

    return {
      unreadMessageCount,
      mentionCount,
      replyCount,
      senders: getSenders('all'),
      mentioners: mentionCount > 0 ? getSenders('mentions') : [],
      repliers: replyCount > 0 ? getSenders('replies') : [],
    };
  })();
}
