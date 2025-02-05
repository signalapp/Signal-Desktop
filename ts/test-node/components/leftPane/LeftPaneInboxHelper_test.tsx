// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { RowType, _testHeaderText } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import type { LeftPaneInboxPropsType } from '../../../components/leftPane/LeftPaneInboxHelper';
import { LeftPaneInboxHelper } from '../../../components/leftPane/LeftPaneInboxHelper';

describe('LeftPaneInboxHelper', () => {
  const defaultProps: LeftPaneInboxPropsType = {
    archivedConversations: [],
    conversations: [],
    filterByUnread: false,
    isSearchingGlobally: false,
    isAboutToSearch: false,
    pinnedConversations: [],
    searchConversation: undefined,
    searchDisabled: false,
    searchTerm: '',
    startSearchCounter: 0,
  };

  describe('getBackAction', () => {
    it("returns undefined; you can't go back from the main inbox", () => {
      const helper = new LeftPaneInboxHelper(defaultProps);

      assert.isUndefined(
        helper.getBackAction({
          showChooseGroupMembers: sinon.fake(),
          showInbox: sinon.fake(),
          startComposing: sinon.fake(),
        })
      );
    });
  });

  describe('getRowCount', () => {
    it('returns 0 if there are no conversations', () => {
      const helper = new LeftPaneInboxHelper(defaultProps);

      assert.strictEqual(helper.getRowCount(), 0);
    });

    it('returns 1 if there are only archived conversations', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        archivedConversations: [getDefaultConversation()],
      });

      assert.strictEqual(helper.getRowCount(), 1);
    });

    it("returns the number of non-pinned conversations if that's all there is", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.strictEqual(helper.getRowCount(), 3);
    });

    it("returns the number of pinned conversations + 1 (for the header) if that's all there is", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.strictEqual(helper.getRowCount(), 3 + 1);
    });

    it('adds 2 rows for each header if there are pinned and non-pinned conversations,', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        pinnedConversations: [getDefaultConversation()],
      });

      assert.strictEqual(helper.getRowCount(), 6);
    });

    it('adds 1 row for the archive button if there are any archived conversations', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        archivedConversations: [getDefaultConversation()],
      });

      assert.strictEqual(helper.getRowCount(), 4);
    });
  });

  describe('getRowIndexToScrollTo', () => {
    it('returns undefined if no conversation is selected', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [getDefaultConversation(), getDefaultConversation()],
        pinnedConversations: [getDefaultConversation()],
      });

      assert.isUndefined(helper.getRowIndexToScrollTo(undefined));
    });

    it('returns undefined if the selected conversation is not pinned or non-pinned', () => {
      const archivedConversations = [getDefaultConversation()];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [getDefaultConversation(), getDefaultConversation()],
        pinnedConversations: [getDefaultConversation()],
        archivedConversations,
      });

      assert.isUndefined(
        helper.getRowIndexToScrollTo(archivedConversations[0].id)
      );
    });

    it("returns the pinned conversation's index + 1 (for the header) if there are only pinned conversations", () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        pinnedConversations,
      });

      assert.strictEqual(
        helper.getRowIndexToScrollTo(pinnedConversations[0].id),
        1
      );
      assert.strictEqual(
        helper.getRowIndexToScrollTo(pinnedConversations[1].id),
        2
      );
    });

    it("returns the conversation's index if there are only non-pinned conversations", () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
      });

      assert.strictEqual(helper.getRowIndexToScrollTo(conversations[0].id), 0);
      assert.strictEqual(helper.getRowIndexToScrollTo(conversations[1].id), 1);
    });

    it("returns the pinned conversation's index + 1 (for the header) if there are both pinned and non-pinned conversations", () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [getDefaultConversation()],
        pinnedConversations,
      });

      assert.strictEqual(
        helper.getRowIndexToScrollTo(pinnedConversations[0].id),
        1
      );
      assert.strictEqual(
        helper.getRowIndexToScrollTo(pinnedConversations[1].id),
        2
      );
    });

    it("returns the non-pinned conversation's index + pinnedConversations.length + 2 (for the headers) if there are both pinned and non-pinned conversations", () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.strictEqual(helper.getRowIndexToScrollTo(conversations[0].id), 5);
      assert.strictEqual(helper.getRowIndexToScrollTo(conversations[1].id), 6);
    });
  });

  describe('getRow', () => {
    it('returns the archive button if there are only archived conversations', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        archivedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 2,
      });
      assert.isUndefined(helper.getRow(1));
    });

    it("returns header and pinned conversations if that's all there are", () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        pinnedConversations,
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:LeftPane--pinned'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: pinnedConversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: pinnedConversations[1],
      });
      assert.isUndefined(helper.getRow(3));
    });

    it('returns header, pinned conversations and an archive button if there are no non-pinned conversations', () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        pinnedConversations,
        archivedConversations: [getDefaultConversation()],
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:LeftPane--pinned'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: pinnedConversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: pinnedConversations[1],
      });
      assert.deepEqual(helper.getRow(3), {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 1,
      });
      assert.isUndefined(helper.getRow(4));
    });

    it("returns non-pinned conversations if that's all there are", () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.isUndefined(helper.getRow(2));
    });

    it('returns non-pinned conversations and an archive button if there are no pinned conversations', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        archivedConversations: [getDefaultConversation()],
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 1,
      });
      assert.isUndefined(helper.getRow(3));
    });

    it('returns headers if there are both pinned and non-pinned conversations', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations,
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:LeftPane--pinned'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: pinnedConversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: pinnedConversations[1],
      });
      assert.deepEqual(
        _testHeaderText(helper.getRow(3)),
        'icu:LeftPane--chats'
      );
      assert.deepEqual(helper.getRow(4), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(helper.getRow(6), {
        type: RowType.Conversation,
        conversation: conversations[2],
      });
      assert.isUndefined(helper.getRow(7));
    });

    it('returns headers if there are both pinned and non-pinned conversations, and an archive button', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations,
        archivedConversations: [getDefaultConversation()],
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:LeftPane--pinned'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: pinnedConversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: pinnedConversations[1],
      });
      assert.deepEqual(
        _testHeaderText(helper.getRow(3)),
        'icu:LeftPane--chats'
      );
      assert.deepEqual(helper.getRow(4), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(helper.getRow(6), {
        type: RowType.Conversation,
        conversation: conversations[2],
      });
      assert.deepEqual(helper.getRow(7), {
        type: RowType.ArchiveButton,
        archivedConversationsCount: 1,
      });
      assert.isUndefined(helper.getRow(8));
    });
  });

  describe('getConversationAndMessageAtIndex', () => {
    it('returns pinned conversations, then non-pinned conversations', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations,
      });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(0)?.conversationId,
        pinnedConversations[0].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(1)?.conversationId,
        pinnedConversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(2)?.conversationId,
        conversations[0].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(3)?.conversationId,
        conversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(4)?.conversationId,
        conversations[2].id
      );
    });

    it("when requesting an index out of bounds, returns the last pinned conversation when that's all there is", () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        pinnedConversations,
      });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(2)?.conversationId,
        pinnedConversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(99)?.conversationId,
        pinnedConversations[1].id
      );
      // This is mostly a resilience measure in case we're ever called with an invalid
      //   index.
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(-1)?.conversationId,
        pinnedConversations[1].id
      );
    });

    it("when requesting an index out of bounds, returns the last non-pinned conversation when that's all there is", () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
      });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(2)?.conversationId,
        conversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(99)?.conversationId,
        conversations[1].id
      );
      // This is mostly a resilience measure in case we're ever called with an invalid
      //   index.
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(-1)?.conversationId,
        conversations[1].id
      );
    });

    it('when requesting an index out of bounds, returns the last non-pinned conversation when there are both pinned and non-pinned conversations', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations,
      });

      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(4)?.conversationId,
        conversations[1].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(99)?.conversationId,
        conversations[1].id
      );
      // This is mostly a resilience measure in case we're ever called with an invalid
      //   index.
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(-1)?.conversationId,
        conversations[1].id
      );
    });

    it('returns undefined if there are no conversations', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        archivedConversations: [getDefaultConversation()],
      });

      assert.isUndefined(helper.getConversationAndMessageAtIndex(0));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(1));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(-1));
    });
  });

  describe('getConversationAndMessageInDirection', () => {
    it('returns the next conversation when searching downward', () => {
      const pinnedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const conversations = [getDefaultConversation()];
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations,
        pinnedConversations,
      });

      assert.deepEqual(
        helper.getConversationAndMessageInDirection(
          { direction: FindDirection.Down, unreadOnly: false },
          pinnedConversations[1].id,
          undefined
        ),
        { conversationId: conversations[0].id }
      );
    });

    // Additional tests are found with `getConversationInDirection`.
  });

  describe('requiresFullWidth', () => {
    it("returns false if we're not about to search in a conversation and there's at least one", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [getDefaultConversation()],
      });

      assert.isFalse(helper.requiresFullWidth());
    });

    it('returns true if there are no conversations', () => {
      const helper = new LeftPaneInboxHelper(defaultProps);

      assert.isTrue(helper.requiresFullWidth());
    });

    it("returns true if we're about to search", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        startSearchCounter: 1,
      });

      assert.isTrue(helper.requiresFullWidth());
    });

    it("returns true if we're about to search in a conversation", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        isAboutToSearch: true,
      });

      assert.isTrue(helper.requiresFullWidth());
    });
  });

  describe('shouldRecomputeRowHeights', () => {
    it("returns false if the number of conversations in each section doesn't change", () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        archivedConversations: [getDefaultConversation()],
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [
            getDefaultConversation(),
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          pinnedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          archivedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        })
      );
    });

    it('returns false if the only thing changed is whether conversations are archived', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        archivedConversations: [getDefaultConversation()],
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [
            getDefaultConversation(),
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          pinnedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        })
      );
    });

    it('returns false if the only thing changed is the number of non-pinned conversations', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [
          getDefaultConversation(),
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        archivedConversations: [getDefaultConversation()],
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [getDefaultConversation()],
          pinnedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          archivedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        })
      );
    });

    it('returns true if the number of pinned conversations changes', () => {
      const helper = new LeftPaneInboxHelper({
        ...defaultProps,
        conversations: [getDefaultConversation()],
        pinnedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        archivedConversations: [getDefaultConversation()],
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [getDefaultConversation()],
          pinnedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          archivedConversations: [getDefaultConversation()],
        })
      );
      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [getDefaultConversation()],
          pinnedConversations: [getDefaultConversation()],
          archivedConversations: [getDefaultConversation()],
        })
      );
      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          ...defaultProps,
          conversations: [getDefaultConversation()],
          pinnedConversations: [],
          archivedConversations: [getDefaultConversation()],
        })
      );
    });
  });
});
