// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';
import { countConversationUnreadStats } from '../../util/countUnreadStats.std.js';
import type {
  UnreadStats,
  ConversationPropsForUnreadStats,
} from '../../util/countUnreadStats.std.js';

function getFutureMutedTimestamp() {
  return Date.now() + 12345;
}

function getPastMutedTimestamp() {
  return Date.now() - 1000;
}

function mockChat(
  props: Partial<ConversationPropsForUnreadStats>
): ConversationPropsForUnreadStats {
  return {
    id: generateUuid(),
    type: 'direct',
    activeAt: Date.now(),
    isArchived: false,
    markedUnread: false,
    unreadCount: 0,
    unreadMentionsCount: 0,
    muteExpiresAt: undefined,
    left: false,
    ...props,
  };
}

function mockStats(props: Partial<UnreadStats>): UnreadStats {
  return {
    unreadCount: 0,
    unreadMentionsCount: 0,
    readChatsMarkedUnreadCount: 0,
    ...props,
  };
}

describe('countUnreadStats', () => {
  describe('countConversationUnreadStats', () => {
    it('returns 0 if the conversation is archived', () => {
      const isArchived = true;

      const archivedConversations = [
        mockChat({ isArchived, markedUnread: false, unreadCount: 0 }),
        mockChat({ isArchived, markedUnread: false, unreadCount: 123 }),
        mockChat({ isArchived, markedUnread: true, unreadCount: 0 }),
        mockChat({ isArchived, markedUnread: true, unreadCount: undefined }),
        mockChat({ isArchived, markedUnread: undefined, unreadCount: 0 }),
      ];

      for (const conversation of archivedConversations) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
      }
    });

    it("returns 0 if the conversation is muted and the user doesn't want to include those in the result", () => {
      const muteExpiresAt = getFutureMutedTimestamp();
      const mutedConversations = [
        mockChat({ muteExpiresAt, markedUnread: false, unreadCount: 0 }),
        mockChat({ muteExpiresAt, markedUnread: false, unreadCount: 9 }),
        mockChat({ muteExpiresAt, markedUnread: true, unreadCount: 0 }),
        mockChat({ muteExpiresAt, markedUnread: true, unreadCount: undefined }),
      ];
      for (const conversation of mutedConversations) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
      }
    });

    it('returns the unread count if nonzero (and not archived)', () => {
      const conversationsWithUnreadCount = [
        mockChat({ unreadCount: 9, markedUnread: false }),
        mockChat({ unreadCount: 9, markedUnread: true }),
        mockChat({ unreadCount: 9, muteExpiresAt: getPastMutedTimestamp() }),
      ];

      for (const conversation of conversationsWithUnreadCount) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ unreadCount: 9 })
        );
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ unreadCount: 9 })
        );
      }

      const mutedWithUnreads = mockChat({
        unreadCount: 123,
        muteExpiresAt: getFutureMutedTimestamp(),
      });
      assert.deepStrictEqual(
        countConversationUnreadStats(mutedWithUnreads, { includeMuted: true }),
        mockStats({ unreadCount: 123 })
      );
    });

    it('returns markedUnread:true if the conversation is marked unread', () => {
      const conversationsMarkedUnread = [
        mockChat({ markedUnread: true }),
        mockChat({
          markedUnread: true,
          muteExpiresAt: getPastMutedTimestamp(),
        }),
      ];
      for (const conversation of conversationsMarkedUnread) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ readChatsMarkedUnreadCount: 1 })
        );
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ readChatsMarkedUnreadCount: 1 })
        );
      }

      const mutedConversationsMarkedUnread = [
        mockChat({
          markedUnread: true,
          muteExpiresAt: getFutureMutedTimestamp(),
        }),
        mockChat({
          markedUnread: true,
          muteExpiresAt: getFutureMutedTimestamp(),
          unreadCount: 0,
        }),
      ];
      for (const conversation of mutedConversationsMarkedUnread) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ readChatsMarkedUnreadCount: 1 })
        );
      }
    });

    it('returns 0 if the conversation is read', () => {
      const readConversations = [
        mockChat({ markedUnread: false, unreadCount: undefined }),
        mockChat({ markedUnread: false, unreadCount: 0 }),
        mockChat({
          markedUnread: false,
          muteExpiresAt: getFutureMutedTimestamp(),
        }),
        mockChat({
          markedUnread: false,
          muteExpiresAt: getPastMutedTimestamp(),
        }),
      ];
      for (const conversation of readConversations) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
      }
    });

    it('returns 0 if the conversation has falsey activeAt', () => {
      const readConversations = [
        mockChat({ activeAt: undefined, unreadCount: 2 }),
        mockChat({
          activeAt: 0,
          unreadCount: 2,
          muteExpiresAt: getPastMutedTimestamp(),
        }),
      ];
      for (const conversation of readConversations) {
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: false }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
        assert.deepStrictEqual(
          countConversationUnreadStats(conversation, { includeMuted: true }),
          mockStats({ unreadCount: 0, readChatsMarkedUnreadCount: 0 })
        );
      }
    });
  });
});
