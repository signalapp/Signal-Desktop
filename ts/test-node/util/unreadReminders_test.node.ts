// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import i18n from './i18n.node.ts';

import { DAY, HOUR, MINUTE } from '../../util/durations/index.std.ts';
import type {
  UnreadReminderCandidate,
  UnreadReminderSummary,
} from '../../util/unreadReminders.std.ts';
import {
  UNREAD_REMINDER_MIN_UNREAD_AGE,
  UNREAD_REMINDER_MAX_AGE,
  filterForConversationsDueReminder,
  getUnreadReminderNotificationContent,
} from '../../util/unreadReminders.std.ts';

const NOW = new Date('2026-09-08T12:00:00.000Z').getTime();

function candidate(
  conversationId: string,
  {
    oldestUnremindedAgo,
    newestUnreadAgo = oldestUnremindedAgo,
  }: { oldestUnremindedAgo: number; newestUnreadAgo?: number }
): UnreadReminderCandidate {
  return {
    conversationId,
    oldestUnremindedReceivedAtMs: NOW - oldestUnremindedAgo,
    newestUnreadReceivedAtMs: NOW - newestUnreadAgo,
  };
}

function idsFor(candidates: ReadonlyArray<UnreadReminderCandidate>) {
  return filterForConversationsDueReminder(candidates, NOW);
}
describe('unreadReminders', () => {
  describe('getCandidateConversationIds', () => {
    it('returns nothing when there are no candidates', () => {
      assert.deepEqual(idsFor([]), []);
    });

    describe('the interval', () => {
      it('does not return a chat before the interval has elapsed', () => {
        assert.deepEqual(
          idsFor([
            candidate('convoId', {
              oldestUnremindedAgo: UNREAD_REMINDER_MIN_UNREAD_AGE - HOUR,
            }),
          ]),
          []
        );
      });

      it('returns a chat once the interval has elapsed', () => {
        assert.deepEqual(
          idsFor([
            candidate('convoId', {
              oldestUnremindedAgo: UNREAD_REMINDER_MIN_UNREAD_AGE + HOUR,
            }),
          ]),
          ['convoId']
        );
      });

      it('anchors on the oldest unreminded message, not the newest unread', () => {
        assert.deepEqual(
          idsFor([
            candidate('convoId', {
              oldestUnremindedAgo: UNREAD_REMINDER_MIN_UNREAD_AGE + DAY,
              newestUnreadAgo: MINUTE,
            }),
          ]),
          ['convoId']
        );
      });
    });

    describe('staleness', () => {
      it('drops a chat whose newest unread is past the max age', () => {
        assert.deepEqual(
          idsFor([
            candidate('convoId', {
              oldestUnremindedAgo: UNREAD_REMINDER_MAX_AGE + DAY,
              newestUnreadAgo: UNREAD_REMINDER_MAX_AGE + HOUR,
            }),
          ]),
          []
        );
      });

      it('keeps a chat with very old backlog but is still active', () => {
        assert.deepEqual(
          idsFor([
            candidate('convoId', {
              oldestUnremindedAgo: UNREAD_REMINDER_MAX_AGE + 100 * DAY,
              newestUnreadAgo: UNREAD_REMINDER_MAX_AGE - DAY,
            }),
          ]),
          ['convoId']
        );
      });
    });

    it('returns the chat waiting longest first', () => {
      assert.deepEqual(
        idsFor([
          candidate('recent', {
            oldestUnremindedAgo: 4 * DAY,
          }),
          candidate('oldest', { oldestUnremindedAgo: 6 * DAY }),
          candidate('middle', { oldestUnremindedAgo: 5 * DAY }),
        ]),
        ['oldest', 'middle', 'recent']
      );
    });

    it('returns only the due, non-stale chats, oldest-due first', () => {
      assert.deepEqual(
        idsFor([
          candidate('not-yet', { oldestUnremindedAgo: HOUR }),
          candidate('due-later', { oldestUnremindedAgo: 4 * DAY }),
          candidate('stale', {
            oldestUnremindedAgo: 30 * DAY,
            newestUnreadAgo: 30 * DAY,
          }),
          candidate('due-first', { oldestUnremindedAgo: 12 * DAY }),
        ]),
        ['due-first', 'due-later']
      );
    });
  });

  describe('getUnreadReminderNotificationContent', () => {
    const FALLBACK_TITLE = 'Signal';
    const CHAT_TITLE = 'Book Club';

    const ALICE = { title: 'Alice' };
    const BOB = { title: 'Bob' };
    const CAROL = { title: 'Carol' };

    function getContent(
      summaryOverrides: Partial<UnreadReminderSummary>,
      contentSetting: 'full' | 'countsOnly' = 'full'
    ) {
      return getUnreadReminderNotificationContent({
        summary: {
          conversationId: 'chat',
          conversationTitle: CHAT_TITLE,
          unreadMessageCount: 0,
          mentionCount: 0,
          replyCount: 0,
          senders: [],
          mentioners: [],
          repliers: [],
          ...summaryOverrides,
        },
        contentSetting,
        fallbackTitle: FALLBACK_TITLE,
        i18n,
      });
    }

    function getBody(
      overrides: Partial<UnreadReminderSummary>,
      contentSetting: 'full' | 'countsOnly' = 'full'
    ): string {
      return getContent(overrides, contentSetting).body;
    }

    describe('unread messages', () => {
      it('one sender', () => {
        assert.strictEqual(
          getBody({ unreadMessageCount: 3, senders: [ALICE] }),
          'You have 3 unread messages from Alice.'
        );
      });

      it('two senders', () => {
        assert.strictEqual(
          getBody({ unreadMessageCount: 5, senders: [ALICE, BOB] }),
          'You have 5 unread messages from Alice and Bob.'
        );
      });

      it('>2 senders', () => {
        assert.strictEqual(
          getBody({ unreadMessageCount: 9, senders: [ALICE, BOB, CAROL] }),
          'You have 9 unread messages from Alice, Bob, and others.'
        );
      });
    });

    describe('mentions', () => {
      it('one person, one mention', () => {
        assert.strictEqual(
          getBody({
            unreadMessageCount: 6,
            mentionCount: 1,
            senders: [ALICE, BOB],
            mentioners: [ALICE],
          }),
          'You have 6 unread messages, including a mention of you by Alice.'
        );
      });

      it('one person, multiple mentions', () => {
        assert.strictEqual(
          getBody({
            unreadMessageCount: 6,
            mentionCount: 4,
            mentioners: [ALICE],
          }),
          'You have 6 unread messages, including 4 mentions of you by Alice.'
        );
      });

      it('many mentioners', () => {
        assert.strictEqual(
          getBody({
            unreadMessageCount: 9,
            mentionCount: 5,
            mentioners: [ALICE, BOB, CAROL],
          }),
          'You have 9 unread messages, including 5 mentions of you by Alice and others.'
        );
      });
    });

    describe('replies', () => {
      it('one reply', () => {
        assert.strictEqual(
          getBody({
            unreadMessageCount: 3,
            replyCount: 1,
            repliers: [ALICE],
          }),
          'You have 3 unread messages, including a reply from Alice.'
        );
      });
    });

    describe('privacy', () => {
      it('names nobody and uses the generic title under countsOnly', () => {
        const result = getContent(
          {
            unreadMessageCount: 4,
            mentionCount: 1,
            replyCount: 1,
            senders: [ALICE],
            mentioners: [ALICE],
            repliers: [BOB],
          },
          'countsOnly'
        );

        assert.deepEqual(result, {
          title: FALLBACK_TITLE,
          body: 'You have 4 unread messages.',
        });
      });

      it('uses the chat title under full privacy', () => {
        assert.strictEqual(
          getContent({ unreadMessageCount: 1, senders: [ALICE] })?.title,
          CHAT_TITLE
        );
      });
    });
  });
});
