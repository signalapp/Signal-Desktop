// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';

import { LeftPaneArchiveHelper } from '../../../components/leftPane/LeftPaneArchiveHelper';

describe('LeftPaneArchiveHelper', () => {
  const fakeConversation = () => ({
    id: uuid(),
    title: uuid(),
    type: 'direct' as const,
  });

  describe('getBackAction', () => {
    it('returns the "show inbox" action', () => {
      const showInbox = sinon.fake();
      const helper = new LeftPaneArchiveHelper({ archivedConversations: [] });

      assert.strictEqual(helper.getBackAction({ showInbox }), showInbox);
    });
  });

  describe('getRowCount', () => {
    it('returns the number of archived conversations', () => {
      assert.strictEqual(
        new LeftPaneArchiveHelper({ archivedConversations: [] }).getRowCount(),
        0
      );
      assert.strictEqual(
        new LeftPaneArchiveHelper({
          archivedConversations: [fakeConversation(), fakeConversation()],
        }).getRowCount(),
        2
      );
    });
  });

  describe('getRowIndexToScrollTo', () => {
    it('returns undefined if no conversation is selected', () => {
      const helper = new LeftPaneArchiveHelper({
        archivedConversations: [fakeConversation(), fakeConversation()],
      });

      assert.isUndefined(helper.getRowIndexToScrollTo(undefined));
    });

    it('returns undefined if the selected conversation is not pinned or non-pinned', () => {
      const helper = new LeftPaneArchiveHelper({
        archivedConversations: [fakeConversation(), fakeConversation()],
      });

      assert.isUndefined(helper.getRowIndexToScrollTo(uuid()));
    });

    it("returns the archived conversation's index", () => {
      const archivedConversations = [fakeConversation(), fakeConversation()];
      const helper = new LeftPaneArchiveHelper({ archivedConversations });

      assert.strictEqual(
        helper.getRowIndexToScrollTo(archivedConversations[0].id),
        0
      );
      assert.strictEqual(
        helper.getRowIndexToScrollTo(archivedConversations[1].id),
        1
      );
    });
  });

  describe('getRow', () => {
    it('returns each conversation as a row', () => {
      const archivedConversations = [fakeConversation(), fakeConversation()];
      const helper = new LeftPaneArchiveHelper({ archivedConversations });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Conversation,
        conversation: archivedConversations[0],
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: archivedConversations[1],
      });
    });
  });

  describe('getConversationAndMessageAtIndex', () => {
    it('returns the conversation at the given index when it exists', () => {
      const archivedConversations = [fakeConversation(), fakeConversation()];
      const helper = new LeftPaneArchiveHelper({ archivedConversations });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(0)?.conversationId,
        archivedConversations[0].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(1)?.conversationId,
        archivedConversations[1].id
      );
    });

    it('when requesting an index out of bounds, returns the last conversation', () => {
      const archivedConversations = [fakeConversation(), fakeConversation()];
      const helper = new LeftPaneArchiveHelper({ archivedConversations });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(2)?.conversationId,
        archivedConversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(99)?.conversationId,
        archivedConversations[1].id
      );

      // This is mostly a resilience measure in case we're ever called with an invalid
      //   index.
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(-1)?.conversationId,
        archivedConversations[1].id
      );
    });

    it('returns undefined if there are no archived conversations', () => {
      const helper = new LeftPaneArchiveHelper({ archivedConversations: [] });

      assert.isUndefined(helper.getConversationAndMessageAtIndex(0));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(1));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(-1));
    });
  });

  describe('getConversationAndMessageInDirection', () => {
    it('returns the next conversation when searching downward', () => {
      const archivedConversations = [fakeConversation(), fakeConversation()];
      const helper = new LeftPaneArchiveHelper({ archivedConversations });

      assert.deepEqual(
        helper.getConversationAndMessageInDirection(
          { direction: FindDirection.Down, unreadOnly: false },
          archivedConversations[0].id,
          undefined
        ),
        { conversationId: archivedConversations[1].id }
      );
    });

    // Additional tests are found with `getConversationInDirection`.
  });

  describe('shouldRecomputeRowHeights', () => {
    it('always returns false because row heights are constant', () => {
      const helper = new LeftPaneArchiveHelper({
        archivedConversations: [fakeConversation(), fakeConversation()],
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          archivedConversations: [fakeConversation()],
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          archivedConversations: [fakeConversation(), fakeConversation()],
        })
      );
    });
  });
});
