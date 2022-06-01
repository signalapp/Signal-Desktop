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
      {
        active_at: Date.now(),
        isArchived: true,
        markedUnread: false,
        unreadCount: 0,
      },
      {
        active_at: Date.now(),
        isArchived: true,
        markedUnread: false,
        unreadCount: 123,
      },
      {
        active_at: Date.now(),
        isArchived: true,
        markedUnread: true,
        unreadCount: 0,
      },
      { active_at: Date.now(), isArchived: true, markedUnread: true },
    ];
    for (const conversation of archivedConversations) {
      assert.strictEqual(getCount(conversation, true), 0);
      assert.strictEqual(getCount(conversation, false), 0);
    }
  });

  it("returns 0 if the conversation is muted and the user doesn't want to include those in the result", () => {
    const mutedConversations = [
      {
        active_at: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: false,
        unreadCount: 0,
      },
      {
        active_at: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: false,
        unreadCount: 9,
      },
      {
        active_at: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: true,
        unreadCount: 0,
      },
      {
        active_at: Date.now(),
        muteExpiresAt: mutedTimestamp(),
        markedUnread: true,
      },
    ];
    for (const conversation of mutedConversations) {
      assert.strictEqual(getCount(conversation, false), 0);
    }
  });

  it('returns the unread count if nonzero (and not archived)', () => {
    const conversationsWithUnreadCount = [
      { active_at: Date.now(), unreadCount: 9, markedUnread: false },
      { active_at: Date.now(), unreadCount: 9, markedUnread: true },
      {
        active_at: Date.now(),
        unreadCount: 9,
        markedUnread: false,
        muteExpiresAt: oldMutedTimestamp(),
      },
      {
        active_at: Date.now(),
        unreadCount: 9,
        markedUnread: false,
        isArchived: false,
      },
    ];
    for (const conversation of conversationsWithUnreadCount) {
      assert.strictEqual(getCount(conversation, false), 9);
      assert.strictEqual(getCount(conversation, true), 9);
    }

    const mutedWithUnreads = {
      active_at: Date.now(),
      unreadCount: 123,
      markedUnread: false,
      muteExpiresAt: mutedTimestamp(),
    };
    assert.strictEqual(getCount(mutedWithUnreads, true), 123);
  });

  it('returns 1 if the conversation is marked unread', () => {
    const conversationsMarkedUnread = [
      { active_at: Date.now(), markedUnread: true },
      { active_at: Date.now(), markedUnread: true, unreadCount: 0 },
      {
        active_at: Date.now(),
        markedUnread: true,
        muteExpiresAt: oldMutedTimestamp(),
      },
      {
        active_at: Date.now(),
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
      {
        active_at: Date.now(),
        markedUnread: true,
        muteExpiresAt: mutedTimestamp(),
      },
      {
        active_at: Date.now(),
        markedUnread: true,
        muteExpiresAt: mutedTimestamp(),
        unreadCount: 0,
      },
    ];
    for (const conversation of mutedConversationsMarkedUnread) {
      assert.strictEqual(getCount(conversation, true), 1);
    }
  });

  it('returns 0 if the conversation is read', () => {
    const readConversations = [
      { active_at: Date.now(), markedUnread: false },
      { active_at: Date.now(), markedUnread: false, unreadCount: 0 },
      {
        active_at: Date.now(),
        markedUnread: false,
        mutedTimestamp: mutedTimestamp(),
      },
      {
        active_at: Date.now(),
        markedUnread: false,
        mutedTimestamp: oldMutedTimestamp(),
      },
    ];
    for (const conversation of readConversations) {
      assert.strictEqual(getCount(conversation, false), 0);
      assert.strictEqual(getCount(conversation, true), 0);
    }
  });

  it('returns 0 if the conversation has falsey active_at', () => {
    const readConversations = [
      { active_at: undefined, markedUnread: false, unreadCount: 2 },
      { active_at: null, markedUnread: true, unreadCount: 0 },
      {
        active_at: 0,
        unreadCount: 2,
        markedUnread: false,
        mutedTimestamp: oldMutedTimestamp(),
      },
    ];
    for (const conversation of readConversations) {
      assert.strictEqual(getCount(conversation, false), 0);
      assert.strictEqual(getCount(conversation, true), 0);
    }
  });
});
