// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getConversationUnreadCountForAppBadge } from '../../util/getConversationUnreadCountForAppBadge';

describe('getConversationUnreadCountForAppBadge', () => {
  const getCount = getConversationUnreadCountForAppBadge;

  const mutedTimestamp = (): number => Date.now() + 12345;
  const oldMutedTimestamp = (): number => Date.now() - 1000;

  it('returns 0 if the conversation is archived', () => {
    const archivedConversations = [
      { isArchived: true, markedUnread: false, unreadCount: 0 },
      { isArchived: true, markedUnread: false, unreadCount: 123 },
      { isArchived: true, markedUnread: true, unreadCount: 0 },
      { isArchived: true, markedUnread: true },
    ];
    for (const conversation of archivedConversations) {
      assert.strictEqual(getCount(conversation, true), 0);
      assert.strictEqual(getCount(conversation, false), 0);
    }
  });

  it("returns 0 if the conversation is muted and the user doesn't want to include those in the result", () => {
    const mutedConversations = [
      { muteExpiresAt: mutedTimestamp(), markedUnread: false, unreadCount: 0 },
      { muteExpiresAt: mutedTimestamp(), markedUnread: false, unreadCount: 9 },
      { muteExpiresAt: mutedTimestamp(), markedUnread: true, unreadCount: 0 },
      { muteExpiresAt: mutedTimestamp(), markedUnread: true },
    ];
    for (const conversation of mutedConversations) {
      assert.strictEqual(getCount(conversation, false), 0);
    }
  });

  it('returns the unread count if nonzero (and not archived)', () => {
    const conversationsWithUnreadCount = [
      { unreadCount: 9, markedUnread: false },
      { unreadCount: 9, markedUnread: true },
      {
        unreadCount: 9,
        markedUnread: false,
        muteExpiresAt: oldMutedTimestamp(),
      },
      { unreadCount: 9, markedUnread: false, isArchived: false },
    ];
    for (const conversation of conversationsWithUnreadCount) {
      assert.strictEqual(getCount(conversation, false), 9);
      assert.strictEqual(getCount(conversation, true), 9);
    }

    const mutedWithUnreads = {
      unreadCount: 123,
      markedUnread: false,
      muteExpiresAt: mutedTimestamp(),
    };
    assert.strictEqual(getCount(mutedWithUnreads, true), 123);
  });

  it('returns 1 if the conversation is marked unread', () => {
    const conversationsMarkedUnread = [
      { markedUnread: true },
      { markedUnread: true, unreadCount: 0 },
      { markedUnread: true, muteExpiresAt: oldMutedTimestamp() },
      {
        markedUnread: true,
        muteExpiresAt: oldMutedTimestamp(),
        isArchived: false,
      },
    ];
    for (const conversation of conversationsMarkedUnread) {
      assert.strictEqual(getCount(conversation, false), 1);
      assert.strictEqual(getCount(conversation, true), 1);
    }

    const mutedConversationsMarkedUnread = [
      { markedUnread: true, muteExpiresAt: mutedTimestamp() },
      { markedUnread: true, muteExpiresAt: mutedTimestamp(), unreadCount: 0 },
    ];
    for (const conversation of mutedConversationsMarkedUnread) {
      assert.strictEqual(getCount(conversation, true), 1);
    }
  });

  it('returns 0 if the conversation is read', () => {
    const readConversations = [
      { markedUnread: false },
      { markedUnread: false, unreadCount: 0 },
      { markedUnread: false, mutedTimestamp: mutedTimestamp() },
      { markedUnread: false, mutedTimestamp: oldMutedTimestamp() },
    ];
    for (const conversation of readConversations) {
      assert.strictEqual(getCount(conversation, false), 0);
      assert.strictEqual(getCount(conversation, true), 0);
    }
  });
});
