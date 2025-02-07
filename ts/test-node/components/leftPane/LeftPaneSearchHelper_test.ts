// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType, _testHeaderText } from '../../../components/ConversationList';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import { LeftPaneSearchHelper } from '../../../components/leftPane/LeftPaneSearchHelper';

const baseSearchHelperArgs = {
  conversationResults: { isLoading: false, results: [] },
  contactResults: { isLoading: false, results: [] },
  filterByUnread: false,
  messageResults: { isLoading: false, results: [] },
  isSearchingGlobally: true,
  searchTerm: 'foo',
  searchConversation: undefined,
  searchDisabled: false,
  startSearchCounter: 0,
};
describe('LeftPaneSearchHelper', () => {
  const fakeMessage = () => ({
    id: uuid(),
    type: 'outgoing',
    conversationId: uuid(),
  });

  describe('getBackAction', () => {
    it('returns undefined; going back is handled elsewhere in the app', () => {
      const helper = new LeftPaneSearchHelper(baseSearchHelperArgs);

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
    it('returns 100 if any results are loading', () => {
      assert.strictEqual(
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }).getRowCount(),
        100
      );
      assert.strictEqual(
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation(), getDefaultConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }).getRowCount(),
        100
      );
      assert.strictEqual(
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
        }).getRowCount(),
        100
      );
    });

    it('returns 0 when there are no search results', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: { isLoading: false, results: [] },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
        isSearchingGlobally: true,
        searchTerm: 'foo',
        searchConversation: undefined,
        searchDisabled: false,
        startSearchCounter: 0,
        filterByUnread: false,
      });

      assert.strictEqual(helper.getRowCount(), 0);
    });

    it('returns 1 + the number of results, dropping empty sections', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [fakeMessage()] },
      });

      assert.strictEqual(helper.getRowCount(), 5);
    });

    it('adds a row for the clear unread filter button when filterByUnread is true', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        filterByUnread: true,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        contactResults: {
          isLoading: false,
          results: [],
        },
        messageResults: {
          isLoading: false,
          results: [],
        },
      });

      // 2 conversations + 1 header + 1 clear filter row = 4
      assert.strictEqual(helper.getRowCount(), 4);
    });
  });

  describe('getRow', () => {
    it('returns a "loading search results" row if any results are loading', () => {
      const helpers = [
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }),
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation(), getDefaultConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }),
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
        }),
      ];

      helpers.forEach(helper => {
        assert.deepEqual(helper.getRow(0), {
          type: RowType.SearchResultsLoadingFakeHeader,
        });
        for (let i = 1; i < 99; i += 1) {
          assert.deepEqual(helper.getRow(i), {
            type: RowType.SearchResultsLoadingFakeRow,
          });
        }
        assert.isUndefined(helper.getRow(100));
      });
    });

    it('returns header + results when all sections have loaded with results', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const contacts = [getDefaultConversation()];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        contactResults: { isLoading: false, results: contacts },
        messageResults: { isLoading: false, results: messages },
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:conversationsHeader'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(_testHeaderText(helper.getRow(3)), 'icu:contactsHeader');
      assert.deepEqual(helper.getRow(4), {
        type: RowType.Conversation,
        conversation: contacts[0],
      });
      assert.deepEqual(_testHeaderText(helper.getRow(5)), 'icu:messagesHeader');
      assert.deepEqual(helper.getRow(6), {
        type: RowType.MessageSearchResult,
        messageId: messages[0].id,
      });
      assert.deepEqual(helper.getRow(7), {
        type: RowType.MessageSearchResult,
        messageId: messages[1].id,
      });
    });

    it('omits conversations when there are no conversation results', () => {
      const contacts = [getDefaultConversation()];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        contactResults: { isLoading: false, results: contacts },
        messageResults: { isLoading: false, results: messages },
      });

      assert.deepEqual(_testHeaderText(helper.getRow(0)), 'icu:contactsHeader');
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: contacts[0],
      });
      assert.deepEqual(_testHeaderText(helper.getRow(2)), 'icu:messagesHeader');
      assert.deepEqual(helper.getRow(3), {
        type: RowType.MessageSearchResult,
        messageId: messages[0].id,
      });
      assert.deepEqual(helper.getRow(4), {
        type: RowType.MessageSearchResult,
        messageId: messages[1].id,
      });
    });

    it('omits contacts when there are no contact results', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        messageResults: { isLoading: false, results: messages },
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:conversationsHeader'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(_testHeaderText(helper.getRow(3)), 'icu:messagesHeader');
      assert.deepEqual(helper.getRow(4), {
        type: RowType.MessageSearchResult,
        messageId: messages[0].id,
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.MessageSearchResult,
        messageId: messages[1].id,
      });
    });

    it('returns the correct row for filter clear button with filterByUnread=true', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        filterByUnread: true,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        contactResults: {
          isLoading: false,
          results: [],
        },
        messageResults: {
          isLoading: false,
          results: [],
        },
      });

      // Row 0: Conversations header
      // Row 1: First conversation
      // Row 2: Second conversation
      // Row 3: Clear filter button
      assert.deepEqual(helper.getRow(3), {
        type: RowType.ClearFilterButton,
        isOnNoResultsPage: false,
      });

      // Out of bounds
      assert.isUndefined(helper.getRow(4));
    });

    it('shows unread header when filterByUnread=true', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        filterByUnread: true,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation()],
        },
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:conversationsUnreadHeader'
      );
    });
  });

  it('omits messages when there are no message results', () => {
    const conversations = [getDefaultConversation(), getDefaultConversation()];
    const contacts = [getDefaultConversation()];

    const helper = new LeftPaneSearchHelper({
      ...baseSearchHelperArgs,
      conversationResults: {
        isLoading: false,
        results: conversations,
      },
      contactResults: { isLoading: false, results: contacts },
    });

    assert.deepEqual(
      _testHeaderText(helper.getRow(0)),
      'icu:conversationsHeader'
    );
    assert.deepEqual(helper.getRow(1), {
      type: RowType.Conversation,
      conversation: conversations[0],
    });
    assert.deepEqual(helper.getRow(2), {
      type: RowType.Conversation,
      conversation: conversations[1],
    });
    assert.deepEqual(_testHeaderText(helper.getRow(3)), 'icu:contactsHeader');
    assert.deepEqual(helper.getRow(4), {
      type: RowType.Conversation,
      conversation: contacts[0],
    });
    assert.isUndefined(helper.getRow(5));
  });

  describe('isScrollable', () => {
    it('returns false if any results are loading', () => {
      const helpers = [
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }),
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation(), getDefaultConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        }),
        new LeftPaneSearchHelper({
          ...baseSearchHelperArgs,
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
        }),
      ];

      helpers.forEach(helper => {
        assert.isFalse(helper.isScrollable());
      });
    });

    it('returns true if all results have loaded', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
      });
      assert.isTrue(helper.isScrollable());
    });
  });

  describe('shouldRecomputeRowHeights', () => {
    it("returns false if the number of results doesn't change", () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation(), getDefaultConversation()],
          },
          contactResults: { isLoading: false, results: [] },
          messageResults: {
            isLoading: false,
            results: [fakeMessage(), fakeMessage(), fakeMessage()],
          },
        })
      );
    });

    it('returns false when a section completes loading, but not all sections are done (because the pane is still loading overall)', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
        })
      );
    });

    it('returns true when all sections finish loading', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: false, results: [fakeMessage()] },
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation(), getDefaultConversation()],
          },
          contactResults: { isLoading: false, results: [] },
          messageResults: { isLoading: false, results: [fakeMessage()] },
        })
      );
    });

    it('returns true if the number of results in a section changes', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          ...baseSearchHelperArgs,
          conversationResults: {
            isLoading: false,
            results: [getDefaultConversation()],
          },
        })
      );
    });
  });

  describe('getConversationAndMessageAtIndex', () => {
    it('returns correct conversation at given index', () => {
      const expected = getDefaultConversation();
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [expected, getDefaultConversation()],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
      });
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(0)?.conversationId,
        expected.id
      );
    });

    it('returns correct contact at given index', () => {
      const expected = getDefaultConversation();
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        contactResults: {
          isLoading: false,
          results: [expected],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
      });
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(2)?.conversationId,
        expected.id
      );
    });

    it('returns correct message at given index', () => {
      const expected = fakeMessage();
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), expected],
        },
      });
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(4)?.messageId,
        expected.id
      );
    });

    it('returns correct message at given index skipping not loaded results', () => {
      const expected = fakeMessage();
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), expected, fakeMessage()],
        },
      });
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(1)?.messageId,
        expected.id
      );
    });

    it('returns undefined if search candidate with given index does not exist', () => {
      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        conversationResults: {
          isLoading: false,
          results: [getDefaultConversation(), getDefaultConversation()],
        },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
      });
      assert.isUndefined(
        helper.getConversationAndMessageAtIndex(100)?.messageId
      );
      assert.isUndefined(
        helper.getConversationAndMessageAtIndex(-100)?.messageId
      );
    });

    it('handles accurate row indexing when filterByUnread is enabled', () => {
      const conversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];

      const helper = new LeftPaneSearchHelper({
        ...baseSearchHelperArgs,
        filterByUnread: true,
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
      });

      // Verify conversation row indexing
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(0)?.conversationId,
        conversations[0].id
      );
      assert.strictEqual(
        helper.getConversationAndMessageAtIndex(1)?.conversationId,
        conversations[1].id
      );

      // Verify clear filter row is skipped (index 2 doesn't map to a conversation)
      assert.isUndefined(helper.getConversationAndMessageAtIndex(2));
    });
  });
});
