// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ToFindType } from '../../../components/leftPane/LeftPaneHelper.dom.js';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper.dom.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';

import { getConversationInDirection } from '../../../components/leftPane/getConversationInDirection.dom.js';

describe('getConversationInDirection', () => {
  const fakeConversation = (markedUnread = false) =>
    getDefaultConversation({ markedUnread });

  const fakeConversations = [
    fakeConversation(),
    fakeConversation(true),
    fakeConversation(true),
    fakeConversation(),
  ];

  describe('searching for any conversation', () => {
    const up: ToFindType = {
      direction: FindDirection.Up,
      unreadOnly: false,
    };
    const down: ToFindType = {
      direction: FindDirection.Down,
      unreadOnly: false,
    };

    it('returns undefined if there are no conversations', () => {
      assert.isUndefined(getConversationInDirection([], up, undefined));
      assert.isUndefined(getConversationInDirection([], down, undefined));
    });

    it('if no conversation is selected, returns the last conversation when going up', () => {
      assert.deepEqual(
        getConversationInDirection(fakeConversations, up, undefined),
        { conversationId: fakeConversations[3].id }
      );
    });

    it('if no conversation is selected, returns the first conversation when going down', () => {
      assert.deepEqual(
        getConversationInDirection(fakeConversations, down, undefined),
        { conversationId: fakeConversations[0].id }
      );
    });

    it('if the first conversation is selected, returns the last conversation when going up', () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          up,
          fakeConversations[0].id
        ),
        { conversationId: fakeConversations[3].id }
      );
    });

    it('if the last conversation is selected, returns the first conversation when going down', () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          down,
          fakeConversations[3].id
        ),
        { conversationId: fakeConversations[0].id }
      );
    });

    it('goes up one conversation in normal cases', () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          up,
          fakeConversations[2].id
        ),
        { conversationId: fakeConversations[1].id }
      );
    });

    it('goes down one conversation in normal cases', () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          down,
          fakeConversations[0].id
        ),
        { conversationId: fakeConversations[1].id }
      );
    });
  });

  describe('searching for unread conversations', () => {
    const up: ToFindType = {
      direction: FindDirection.Up,
      unreadOnly: true,
    };
    const down: ToFindType = {
      direction: FindDirection.Down,
      unreadOnly: true,
    };

    const noUnreads = [
      fakeConversation(),
      fakeConversation(),
      fakeConversation(),
    ];

    it('returns undefined if there are no conversations', () => {
      assert.isUndefined(getConversationInDirection([], up, undefined));
      assert.isUndefined(getConversationInDirection([], down, undefined));
    });

    it('if no conversation is selected, finds the last unread conversation (if it exists) when searching up', () => {
      assert.deepEqual(
        getConversationInDirection(fakeConversations, up, undefined),
        { conversationId: fakeConversations[2].id }
      );
      assert.isUndefined(getConversationInDirection(noUnreads, up, undefined));
    });

    it('if no conversation is selected, finds the first unread conversation (if it exists) when searching down', () => {
      assert.deepEqual(
        getConversationInDirection(fakeConversations, down, undefined),
        { conversationId: fakeConversations[1].id }
      );
      assert.isUndefined(
        getConversationInDirection(noUnreads, down, undefined)
      );
    });

    it("searches up for unread conversations, returning undefined if no conversation exists (doesn't wrap around)", () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          up,
          fakeConversations[3].id
        ),
        { conversationId: fakeConversations[2].id }
      );
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          up,
          fakeConversations[2].id
        ),
        { conversationId: fakeConversations[1].id }
      );
      assert.isUndefined(
        getConversationInDirection(
          fakeConversations,
          up,
          fakeConversations[1].id
        )
      );
      assert.isUndefined(
        getConversationInDirection(noUnreads, up, noUnreads[2].id)
      );
    });

    it("searches down for unread conversations, returning undefined if no conversation exists (doesn't wrap around)", () => {
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          down,
          fakeConversations[0].id
        ),
        { conversationId: fakeConversations[1].id }
      );
      assert.deepEqual(
        getConversationInDirection(
          fakeConversations,
          down,
          fakeConversations[1].id
        ),
        { conversationId: fakeConversations[2].id }
      );
      assert.isUndefined(
        getConversationInDirection(
          fakeConversations,
          down,
          fakeConversations[2].id
        )
      );
      assert.isUndefined(
        getConversationInDirection(noUnreads, down, noUnreads[1].id)
      );
    });
  });
});
