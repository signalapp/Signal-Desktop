// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cwd } from 'node:process';

import { ReadStatus } from '../../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../../MessageSeenStatus.std.ts';
import type { WritableDB } from '../../../sql/Interface.std.ts';
import { setupTests } from '../../../sql/Server.node.ts';
import type { UnreadReminderFilter } from '../../../sql/server/unreadReminders.std.ts';
import {
  getUnremindedUnreadMessageTimeRanges,
  getUnremindedUnreadMessageTimeRangesQuery,
  getUnreadReminderCountQuery,
  getUnreadReminderSendersQuery,
  getUnreadReminderSummaryData,
} from '../../../sql/server/unreadReminders.std.ts';
import { createDB, explain, insertData } from '../helpers.node.ts';
import { generateAci } from '../../../test-helpers/serviceIdUtils.std.ts';
import { DAY } from '../../../util/durations/constants.std.ts';

const OUR_ACI = generateAci();
const ALICE_ACI = generateAci();
const BOB_ACI = generateAci();

const yesterday = Date.now() - DAY;

let messageCounter = 0;

type MessageOverrides = {
  conversationId: string;
  receivedAtMs?: number | null;
  readStatus?: ReadStatus;
  sourceServiceId?: string;
  mentionsMe?: 0 | 1;
  quoteAuthorAci?: string;
  storyId?: string | null;
};

function composeMessage(overrides: MessageOverrides) {
  messageCounter += 1;
  const {
    conversationId,
    receivedAtMs = yesterday,
    readStatus = ReadStatus.Unread,
    sourceServiceId = ALICE_ACI,
    mentionsMe = 0,
    quoteAuthorAci,
    storyId = null,
  } = overrides;

  const json: Record<string, unknown> = { id: `m${messageCounter}` };
  if (quoteAuthorAci != null) {
    json.quote = { authorAci: quoteAuthorAci };
  }

  return {
    id: `m${messageCounter}`,
    conversationId,
    type: 'incoming',
    readStatus,
    seenStatus: SeenStatus.Unseen,
    received_at: messageCounter,
    received_at_ms: receivedAtMs,
    sent_at: receivedAtMs ?? yesterday,
    sourceServiceId,
    mentionsMe,
    storyId,
    json: JSON.stringify(json),
  };
}

describe('sql/server/unreadReminders', () => {
  let db: WritableDB;
  beforeEach(() => {
    messageCounter = 0;
    db = createDB();
    setupTests(db, { userDataPath: cwd() });
    insertData(db, 'conversations', [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
  });
  afterEach(() => {
    db.close();
  });

  describe('getUnremindedUnreadMessageTimeRanges', () => {
    it('returns the oldest and newest unread arrival for a conversation', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1', receivedAtMs: yesterday }),
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday + 5_000,
        }),
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday + 1_000,
        }),
      ]);

      assert.deepEqual(
        getUnremindedUnreadMessageTimeRanges(db, [
          {
            conversationId: 'c1',
            lastRemindedAt: 0,
            includeStoryReplies: true,
          },
        ]),
        [
          {
            conversationId: 'c1',
            oldestUnremindedReceivedAtMs: yesterday,
            newestUnreadReceivedAtMs: yesterday + 5_000,
          },
        ]
      );
    });

    it('excludes activity before lastRemindedAt', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1', receivedAtMs: yesterday }),
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday + 10_000,
        }),
      ]);

      const result = getUnremindedUnreadMessageTimeRanges(db, [
        {
          conversationId: 'c1',
          lastRemindedAt: yesterday + 5_000,
          includeStoryReplies: true,
        },
      ]);

      assert.deepEqual(result, [
        {
          conversationId: 'c1',
          oldestUnremindedReceivedAtMs: yesterday + 10_000,
          newestUnreadReceivedAtMs: yesterday + 10_000,
        },
      ]);
    });

    it('omits a conversation whose unread all predates the cutoff', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1', receivedAtMs: yesterday }),
      ]);

      assert.deepEqual(
        getUnremindedUnreadMessageTimeRanges(db, [
          {
            conversationId: 'c1',
            lastRemindedAt: yesterday + 1,
            includeStoryReplies: true,
          },
        ]),
        []
      );
    });

    it('ignores read messages', () => {
      insertData(db, 'messages', [
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday,
          readStatus: ReadStatus.Read,
        }),
      ]);

      assert.deepEqual(
        getUnremindedUnreadMessageTimeRanges(db, [
          {
            conversationId: 'c1',
            lastRemindedAt: 0,
            includeStoryReplies: true,
          },
        ]),
        []
      );
    });

    it('respects includeStoryReplies', () => {
      insertData(db, 'messages', [
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday,
          storyId: 'story1',
        }),
      ]);

      assert.deepEqual(
        getUnremindedUnreadMessageTimeRanges(db, [
          {
            conversationId: 'c1',
            lastRemindedAt: 0,
            includeStoryReplies: false,
          },
        ]),
        []
      );
      assert.equal(
        getUnremindedUnreadMessageTimeRanges(db, [
          {
            conversationId: 'c1',
            lastRemindedAt: 0,
            includeStoryReplies: true,
          },
        ]).length,
        1
      );
    });
  });

  describe('getUnreadReminderSummaryData', () => {
    const options = { includeStoryReplies: true, ourAci: OUR_ACI };

    it('counts unread messages and their senders, most recent first', () => {
      insertData(db, 'messages', [
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday,
          sourceServiceId: ALICE_ACI,
        }),
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday + 5_000,
          sourceServiceId: BOB_ACI,
        }),
        composeMessage({
          conversationId: 'c1',
          receivedAtMs: yesterday + 1_000,
          sourceServiceId: ALICE_ACI,
        }),
      ]);

      const data = getUnreadReminderSummaryData(db, 'c1', options);
      assert.equal(data.unreadMessageCount, 3);
      assert.deepEqual(
        data.senders.map(({ sourceServiceId }) => sourceServiceId),
        [BOB_ACI, ALICE_ACI]
      );
    });

    it('counts mentions of us and who made them', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1', mentionsMe: 1 }),
        composeMessage({ conversationId: 'c1', mentionsMe: 0 }),
      ]);

      const data = getUnreadReminderSummaryData(db, 'c1', options);
      assert.equal(data.mentionCount, 1);
      assert.deepEqual(
        data.mentioners.map(({ sourceServiceId }) => sourceServiceId),
        [ALICE_ACI]
      );
    });

    it('counts only replies quoting our own ACI', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1', quoteAuthorAci: OUR_ACI }),
        composeMessage({ conversationId: 'c1', quoteAuthorAci: BOB_ACI }),
        composeMessage({ conversationId: 'c1' }),
      ]);

      const data = getUnreadReminderSummaryData(db, 'c1', options);
      assert.equal(data.replyCount, 1);
      assert.deepEqual(
        data.repliers.map(({ sourceServiceId }) => sourceServiceId),
        [ALICE_ACI]
      );
    });

    it('does not count a reply that has already been read', () => {
      insertData(db, 'messages', [
        composeMessage({
          conversationId: 'c1',
          quoteAuthorAci: OUR_ACI,
          readStatus: ReadStatus.Read,
        }),
      ]);

      assert.equal(
        getUnreadReminderSummaryData(db, 'c1', options).replyCount,
        0
      );
    });

    it('is scoped to a single conversation', () => {
      insertData(db, 'messages', [
        composeMessage({ conversationId: 'c1' }),
        composeMessage({ conversationId: 'c2' }),
        composeMessage({ conversationId: 'c2' }),
      ]);

      assert.equal(
        getUnreadReminderSummaryData(db, 'c1', options).unreadMessageCount,
        1
      );
    });
  });

  describe('query plans', () => {
    it('getUnremindedUnreadMessageTimeRangesQuery uses messages_unread_no_story_id index', () => {
      const details = explain(
        db,
        getUnremindedUnreadMessageTimeRangesQuery([
          {
            conversationId: 'c1',
            lastRemindedAt: 0,
            includeStoryReplies: true,
          },
          {
            conversationId: 'c2',
            lastRemindedAt: yesterday,
            includeStoryReplies: false,
          },
        ])
      );

      assert.ok(
        details.includes(
          'SEARCH messages USING INDEX messages_unread_no_story_id ' +
            '(conversationId=? AND readStatus=? AND isStory=?)'
        ),
        details
      );
      assert.ok(!details.includes('SCAN messages'), details);
    });

    describe('summaryData', () => {
      for (const includeStoryReplies of [true, false]) {
        for (const filter of ['all', 'mentions', 'replies']) {
          // oxlint-disable-next-line no-loop-func
          it(`getUnreadReminderSendersQuery: ${filter}, ${includeStoryReplies}`, () => {
            const details = explain(
              db,
              getUnreadReminderSendersQuery(
                'c1',
                filter as UnreadReminderFilter,
                {
                  includeStoryReplies,
                  ourAci: OUR_ACI,
                }
              )
            );
            assert.ok(
              details.includes(`SEARCH messages USING INDEX messages_unread`),
              `${details} uses messages_unread* index`
            );
            assert.ok(!details.includes('SCAN'), `${details} does not scan`);
          });
          // oxlint-disable-next-line no-loop-func
          it(`getUnreadReminderCountQuery: ${filter}, ${includeStoryReplies}`, () => {
            const details = explain(
              db,
              getUnreadReminderCountQuery(
                'c1',
                filter as UnreadReminderFilter,
                {
                  includeStoryReplies,
                  ourAci: OUR_ACI,
                }
              )
            );

            assert.ok(
              details.includes(`SEARCH messages USING INDEX messages_unread`),
              `${details} uses messages_unread* index`
            );
            assert.ok(!details.includes('SCAN'), `${details} does not scan`);
          });
        }
      }
    });
  });
});
