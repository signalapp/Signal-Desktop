// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { countConversationUnreadStats } from '../../util/countUnreadStats';

describe('countConversationUnreadStats', () => {
  const mutedTimestamp = (): number => Date.now() + 12345;
  const oldMutedTimestamp = (): number => Date.now() - 1000;

  it('returns 0 if the conversation is archived', () => {
    const archivedConversations = [
      {
        activeAt: Date.now(),
        isArchived: true,
        markedUnread: false,
        unreadCount: 0,
      },
      {
        activeAt: Date.now(),
        isArchived: true,
        markedUnread: false,
        unreadCount: 123,
      },
      {
        activeAt: Date.now(),
        isArchived: true,
        markedUnread: true,
        unreadCount: 0,
      },
      { activeAt: Date.now(), isArchived: true, markedUnread: true },
    ];
    for (const conversation of archivedConversations) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
    }
  });

  it("returns 0 if the conversation is muted and the user doesn't want to include those in the result", () => {
    const mutedConversations = [
      {
        activeAt: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: false,
        unreadCount: 0,
      },
      {
        activeAt: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: false,
        unreadCount: 9,
      },
      {
        activeAt: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: true,
        unreadCount: 0,
      },
      {
        activeAt: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: true,
      },
    ];
    for (const conversation of mutedConversations) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
    }
  });

  it('returns the unread count if nonzero (and not archived)', () => {
    const conversationsWithUnreadCount = [
      { activeAt: Date.now(), unreadCount: 9, markedUnread: false },
      { activeAt: Date.now(), unreadCount: 9, markedUnread: true },
      {
        activeAt: Date.now(),
        unreadCount: 9,
        markedUnread: false,
        muteExpiresAt: oldMutedTimestamp(),
      },
      {
        activeAt: Date.now(),
        unreadCount: 9,
        markedUnread: false,
        isArchived: false,
      },
    ];
    for (const conversation of conversationsWithUnreadCount) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 9,
          unreadMentionsCount: 0,
          markedUnread: conversation.markedUnread,
        }
      );
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 9,
          unreadMentionsCount: 0,
          markedUnread: conversation.markedUnread,
        }
      );
    }

    const mutedWithUnreads = {
      activeAt: Date.now(),
      unreadCount: 123,
      markedUnread: false,
      muteExpiresAt: mutedTimestamp(),
    };
    assert.deepStrictEqual(
      countConversationUnreadStats(mutedWithUnreads, { includeMuted: true }),
      {
        unreadCount: 123,
        unreadMentionsCount: 0,
        markedUnread: false,
      }
    );
  });

  it('returns markedUnread:true if the conversation is marked unread', () => {
    const conversationsMarkedUnread = [
      { activeAt: Date.now(), markedUnread: true },
      { activeAt: Date.now(), markedUnread: true, unreadCount: 0 },
      {
        activeAt: Date.now(),
        markedUnread: true,
        muteExpiresAt: oldMutedTimestamp(),
      },
      {
        activeAt: Date.now(),
        markedUnread: true,
        muteExpiresAt: oldMutedTimestamp(),
        isArchived: false,
      },
    ];
    for (const conversation of conversationsMarkedUnread) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: true,
        }
      );
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: true,
        }
      );
    }

    const mutedConversationsMarkedUnread = [
      {
        activeAt: Date.now(),
        markedUnread: true,
        muteExpiresAt: mutedTimestamp(),
      },
      {
        activeAt: Date.now(),
        markedUnread: true,
        muteExpiresAt: mutedTimestamp(),
        unreadCount: 0,
      },
    ];
    for (const conversation of mutedConversationsMarkedUnread) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: true,
        }
      );
    }
  });

  it('returns 0 if the conversation is read', () => {
    const readConversations = [
      { activeAt: Date.now(), markedUnread: false },
      { activeAt: Date.now(), markedUnread: false, unreadCount: 0 },
      {
        activeAt: Date.now(),
        markedUnread: false,
        mutedTimestamp: mutedTimestamp(),
      },
      {
        activeAt: Date.now(),
        markedUnread: false,
        mutedTimestamp: oldMutedTimestamp(),
      },
    ];
    for (const conversation of readConversations) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
    }
  });

  it('returns 0 if the conversation has falsey activeAt', () => {
    const readConversations = [
      { activeAt: undefined, markedUnread: false, unreadCount: 2 },
      {
        activeAt: 0,
        unreadCount: 2,
        markedUnread: false,
        mutedTimestamp: oldMutedTimestamp(),
      },
    ];
    for (const conversation of readConversations) {
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: false }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
      assert.deepStrictEqual(
        countConversationUnreadStats(conversation, { includeMuted: true }),
        {
          unreadCount: 0,
          unreadMentionsCount: 0,
          markedUnread: false,
        }
      );
    }
  });
});
