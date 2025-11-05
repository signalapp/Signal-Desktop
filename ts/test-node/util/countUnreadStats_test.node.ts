// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { v4 as generateUuid } from 'uuid';
import {
  _canCountConversation,
  _countConversation,
  _createUnreadStats,
  _shouldExcludeMuted,
  countAllChatFoldersUnreadStats,
  countAllConversationsUnreadStats,
  countConversationUnreadStats,
  isConversationUnread,
} from '../../util/countUnreadStats.std.js';
import type {
  UnreadStats,
  ConversationPropsForUnreadStats,
  UnreadStatsIncludeMuted,
} from '../../util/countUnreadStats.std.js';
import type { CurrentChatFolder } from '../../types/CurrentChatFolders.std.js';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.js';
import type { ChatFolderId } from '../../types/ChatFolder.std.js';
import { CHAT_FOLDER_DEFAULTS } from '../../types/ChatFolder.std.js';

function getFutureMutedTimestamp() {
  return Date.now() + 12345;
}

function getPastMutedTimestamp() {
  return Date.now() - 1000;
}

type ChatProps = Partial<ConversationPropsForUnreadStats>;
type StatsProps = Partial<UnreadStats>;

function mockChat(props: ChatProps): ConversationPropsForUnreadStats {
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

function mockStats(props: StatsProps): UnreadStats {
  return {
    unreadCount: 0,
    unreadMentionsCount: 0,
    readChatsMarkedUnreadCount: 0,
    ...props,
  };
}

type FolderProps = Partial<CurrentChatFolder>;

function mockFolder(props: FolderProps): CurrentChatFolder {
  return {
    ...CHAT_FOLDER_DEFAULTS,
    id: generateUuid() as ChatFolderId,
    position: 0,
    deletedAtTimestampMs: 0,
    storageID: null,
    storageVersion: null,
    storageNeedsSync: false,
    storageUnknownFields: null,
    ...props,
  } as CurrentChatFolder;
}

describe('countUnreadStats', () => {
  describe('_shouldExcludeMuted', () => {
    it('should return the correct results', () => {
      assert.equal(_shouldExcludeMuted('force-exclude'), true);
      assert.equal(_shouldExcludeMuted('setting-off'), true);
      assert.equal(_shouldExcludeMuted('force-include'), false);
      assert.equal(_shouldExcludeMuted('setting-on'), false);
    });
  });

  describe('_canCountConversation', () => {
    function check(
      chat: ChatProps,
      expected: boolean,
      includeMuted: UnreadStatsIncludeMuted = 'force-include'
    ) {
      const actual = _canCountConversation(mockChat(chat), {
        activeProfile: undefined,
        includeMuted,
      });
      assert.equal(actual, expected);
    }

    it('should exclude inactive conversations', () => {
      check({ activeAt: undefined }, false);
      check({ activeAt: 0 }, false);
      check({ activeAt: 1 }, true);
      check({ activeAt: 100_000_000 }, true);
    });

    it('should exclude archived conversations', () => {
      check({ isArchived: undefined }, true);
      check({ isArchived: false }, true);
      check({ isArchived: true }, false);
    });

    it('should include/exclude muted chats based on option', () => {
      const past = getPastMutedTimestamp();
      const future = getFutureMutedTimestamp();

      check({ muteExpiresAt: undefined }, true, 'force-include');
      check({ muteExpiresAt: past }, true, 'force-include');
      check({ muteExpiresAt: future }, true, 'force-include');

      check({ muteExpiresAt: undefined }, true, 'force-exclude');
      check({ muteExpiresAt: past }, true, 'force-exclude');
      check({ muteExpiresAt: future }, false, 'force-exclude');
    });

    it('should exclude left conversations', () => {
      check({ left: undefined }, true);
      check({ left: false }, true);
      check({ left: true }, false);
    });
  });

  describe('_countConversation', () => {
    function check(chat: ChatProps, expected: StatsProps) {
      const actual = _createUnreadStats();
      _countConversation(actual, mockChat(chat));
      assert.deepEqual(actual, mockStats(expected));
    }

    it('should count unreadCount', () => {
      check({ unreadCount: undefined }, { unreadCount: 0 });
      check({ unreadCount: 0 }, { unreadCount: 0 });
      check({ unreadCount: 1 }, { unreadCount: 1 });
      check({ unreadCount: 42 }, { unreadCount: 42 });
    });

    it('should count unreadMentionsCount', () => {
      check({ unreadMentionsCount: undefined }, { unreadMentionsCount: 0 });
      check({ unreadMentionsCount: 0 }, { unreadMentionsCount: 0 });
      check({ unreadMentionsCount: 1 }, { unreadMentionsCount: 1 });
      check({ unreadMentionsCount: 42 }, { unreadMentionsCount: 42 });
    });

    it('should count readChatsMarkedUnreadCount', () => {
      const read = { readChatsMarkedUnreadCount: 1 };
      const unread = { unreadCount: 42, readChatsMarkedUnreadCount: 0 };
      const mentions = {
        unreadMentionsCount: 42,
        readChatsMarkedUnreadCount: 0,
      };

      check({ unreadCount: undefined, markedUnread: true }, read);
      check({ unreadCount: 0, markedUnread: true }, read);
      check({ unreadCount: 42, markedUnread: true }, unread);

      check({ unreadMentionsCount: undefined, markedUnread: true }, read);
      check({ unreadMentionsCount: 0, markedUnread: true }, read);
      check({ unreadMentionsCount: 42, markedUnread: true }, mentions);
    });
  });

  describe('isConversationUnread', () => {
    function check(
      chat: ChatProps,
      expected: boolean,
      includeMuted: UnreadStatsIncludeMuted = 'force-exclude'
    ) {
      const actual = isConversationUnread(mockChat(chat), {
        activeProfile: undefined,
        includeMuted,
      });
      assert.equal(actual, expected);
    }

    it('should count unreadCount', () => {
      check({ unreadCount: undefined }, false);
      check({ unreadCount: 0 }, false);
      check({ unreadCount: 1 }, true);
      check({ unreadCount: 42 }, true);
    });

    it('should count unreadMentionsCount', () => {
      check({ unreadMentionsCount: undefined }, false);
      check({ unreadMentionsCount: 0 }, false);
      check({ unreadMentionsCount: 1 }, true);
      check({ unreadMentionsCount: 42 }, true);
    });

    it('should count markedUnread', () => {
      check({ markedUnread: undefined }, false);
      check({ markedUnread: false }, false);
      check({ markedUnread: true }, true);
    });

    it('should check if it can count the conversation', () => {
      const future = getFutureMutedTimestamp();
      check({ unreadCount: 1, activeAt: 0 }, false);
      check({ unreadCount: 1, isArchived: true }, false);
      check({ unreadCount: 1, muteExpiresAt: future }, false);
      check({ unreadCount: 1, muteExpiresAt: future }, true, 'force-include');
      check({ unreadCount: 1, left: true }, false);
    });
  });

  describe('countConversationUnreadStats', () => {
    function check(
      chat: ChatProps,
      expected: StatsProps,
      includeMuted: UnreadStatsIncludeMuted = 'force-exclude'
    ) {
      const actual = countConversationUnreadStats(mockChat(chat), {
        activeProfile: undefined,
        includeMuted,
      });
      assert.deepEqual(actual, mockStats(expected));
    }

    it('should count all stats', () => {
      check({ unreadCount: 0 }, { unreadCount: 0 });
      check({ unreadCount: 1 }, { unreadCount: 1 });
      check({ unreadMentionsCount: 0 }, { unreadMentionsCount: 0 });
      check({ unreadMentionsCount: 1 }, { unreadMentionsCount: 1 });
      check({ markedUnread: false }, { readChatsMarkedUnreadCount: 0 });
      check({ markedUnread: true }, { readChatsMarkedUnreadCount: 1 });
    });

    it('should check if it can count the conversation', () => {
      const isCounted = { unreadCount: 10 };
      const isNotCounted = { unreadCount: 0 };

      const unread = { unreadCount: 10 };
      const inactive = { ...unread, activeAt: 0 };
      const archived = { ...unread, isArchived: true };
      const muted = { ...unread, muteExpiresAt: getFutureMutedTimestamp() };
      const left = { ...unread, left: true };

      check(inactive, isNotCounted);
      check(archived, isNotCounted);
      check(muted, isNotCounted);
      check(muted, isCounted, 'force-include');
      check(left, isNotCounted);
    });
  });

  describe('countAllConversationsUnreadStats', () => {
    function check(
      chats: ReadonlyArray<ChatProps>,
      expected: StatsProps,
      includeMuted: UnreadStatsIncludeMuted = 'force-exclude'
    ) {
      const actual = countAllConversationsUnreadStats(chats.map(mockChat), {
        activeProfile: undefined,
        includeMuted,
      });
      assert.deepEqual(actual, mockStats(expected));
    }

    it('should count all stats', () => {
      const read = { unreadCount: 0 };
      const unread = { unreadCount: 10 };
      const mentions = { unreadMentionsCount: 10 };
      const markedUnread = { markedUnread: true };
      const unreadAndMarkedUnread = { ...unread, ...markedUnread };

      check([read], { unreadCount: 0 });
      check([read, read], { unreadCount: 0 });
      check([read, unread], { unreadCount: 10 });

      check([unread], { unreadCount: 10 });
      check([unread, unread], { unreadCount: 20 });

      check([mentions], { unreadMentionsCount: 10 });
      check([mentions, mentions], { unreadMentionsCount: 20 });

      check([markedUnread], { readChatsMarkedUnreadCount: 1 });
      check([markedUnread, markedUnread], { readChatsMarkedUnreadCount: 2 });
      check([unreadAndMarkedUnread], {
        unreadCount: 10,
        readChatsMarkedUnreadCount: 0,
      });
    });

    it('should check if each conversation can be counted', () => {
      const isCounted = { unreadCount: 20 };
      const isNotCounted = { unreadCount: 10 };

      const unread = { unreadCount: 10 };
      const inactive = { ...unread, activeAt: 0 };
      const archived = { ...unread, isArchived: true };
      const muted = { ...unread, muteExpiresAt: getFutureMutedTimestamp() };
      const left = { ...unread, left: true };

      check([unread, inactive], isNotCounted);
      check([unread, archived], isNotCounted);
      check([unread, muted], isNotCounted);
      check([unread, muted], isCounted, 'force-include');
      check([unread, left], isNotCounted);
    });
  });

  describe('countAllChatFoldersUnreadStats', () => {
    function check(
      chats: ReadonlyArray<ChatProps>,
      items: ReadonlyArray<{
        folder: FolderProps;
        stats: StatsProps | null;
      }>,
      includeMuted: UnreadStatsIncludeMuted = 'force-exclude'
    ) {
      const folders: Array<CurrentChatFolder> = [];
      const expected = new Map<ChatFolderId, UnreadStats>();

      for (const item of items) {
        const folder = mockFolder(item.folder);
        folders.push(folder);
        if (item.stats != null) {
          expected.set(folder.id, mockStats(item.stats));
        }
      }

      const actual = countAllChatFoldersUnreadStats(
        CurrentChatFolders.fromArray(folders),
        chats.map(mockChat),
        { activeProfile: undefined, includeMuted }
      );

      assert.deepEqual(actual, expected);
    }

    it('should count each chat folder', () => {
      const muted = { muteExpiresAt: getFutureMutedTimestamp() };

      const chats: Array<ChatProps> = [
        { type: 'group', unreadCount: 5 },
        { type: 'group', unreadCount: 2 },
        { type: 'group', unreadCount: 1, ...muted },
        { type: 'direct', unreadCount: 50 },
        { type: 'direct', unreadCount: 20 },
        { type: 'direct', unreadCount: 10, ...muted },
      ];

      const empty = {};
      const allGroups = { includeAllGroupChats: true };
      const allDirect = { includeAllIndividualChats: true };
      const all = { ...allGroups, ...allDirect };

      // no chats
      check([], []);
      check([], [{ folder: all, stats: null }]);

      // no folders
      check(chats, []);

      // empty folder
      check(chats, [{ folder: empty, stats: null }]);

      check(chats, [
        { folder: all, stats: { unreadCount: 77 } },
        { folder: allGroups, stats: { unreadCount: 7 } },
        { folder: allDirect, stats: { unreadCount: 70 } },
      ]);

      check(
        chats,
        [
          { folder: all, stats: { unreadCount: 88 } },
          { folder: allGroups, stats: { unreadCount: 8 } },
          { folder: allDirect, stats: { unreadCount: 80 } },
        ],
        'force-include'
      );
    });
  });
});
