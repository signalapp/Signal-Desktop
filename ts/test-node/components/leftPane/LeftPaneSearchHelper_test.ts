// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';

import { LeftPaneSearchHelper } from '../../../components/leftPane/LeftPaneSearchHelper';

describe('LeftPaneSearchHelper', () => {
  const fakeConversation = () => ({
    id: uuid(),
    title: uuid(),
    type: 'direct' as const,
  });

  const fakeMessage = () => ({
    id: uuid(),
    conversationId: uuid(),
  });

  describe('getBackAction', () => {
    it('returns undefined; going back is handled elsewhere in the app', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: { isLoading: false, results: [] },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
        searchTerm: 'foo',
      });

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
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }).getRowCount(),
        100
      );
      assert.strictEqual(
        new LeftPaneSearchHelper({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation(), fakeConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }).getRowCount(),
        100
      );
      assert.strictEqual(
        new LeftPaneSearchHelper({
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
          searchTerm: 'foo',
        }).getRowCount(),
        100
      );
    });

    it('returns 0 when there are no search results', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: { isLoading: false, results: [] },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
        searchTerm: 'foo',
      });

      assert.strictEqual(helper.getRowCount(), 0);
    });

    it('returns 1 + the number of results, dropping empty sections', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: [fakeConversation(), fakeConversation()],
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [fakeMessage()] },
        searchTerm: 'foo',
      });

      assert.strictEqual(helper.getRowCount(), 5);
    });
  });

  describe('getRow', () => {
    it('returns a "loading search results" row if any results are loading', () => {
      const helpers = [
        new LeftPaneSearchHelper({
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }),
        new LeftPaneSearchHelper({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation(), fakeConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }),
        new LeftPaneSearchHelper({
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
          searchTerm: 'foo',
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
      const conversations = [fakeConversation(), fakeConversation()];
      const contacts = [fakeConversation()];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        contactResults: { isLoading: false, results: contacts },
        messageResults: { isLoading: false, results: messages },
        searchTerm: 'foo',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'conversationsHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(helper.getRow(3), {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
      assert.deepEqual(helper.getRow(4), {
        type: RowType.Conversation,
        conversation: contacts[0],
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      });
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
      const contacts = [fakeConversation()];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: [],
        },
        contactResults: { isLoading: false, results: contacts },
        messageResults: { isLoading: false, results: messages },
        searchTerm: 'foo',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: contacts[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      });
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
      const conversations = [fakeConversation(), fakeConversation()];
      const messages = [fakeMessage(), fakeMessage()];

      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: messages },
        searchTerm: 'foo',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'conversationsHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: conversations[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Conversation,
        conversation: conversations[1],
      });
      assert.deepEqual(helper.getRow(3), {
        type: RowType.Header,
        i18nKey: 'messagesHeader',
      });
      assert.deepEqual(helper.getRow(4), {
        type: RowType.MessageSearchResult,
        messageId: messages[0].id,
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.MessageSearchResult,
        messageId: messages[1].id,
      });
    });
  });

  it('omits messages when there are no message results', () => {
    const conversations = [fakeConversation(), fakeConversation()];
    const contacts = [fakeConversation()];

    const helper = new LeftPaneSearchHelper({
      conversationResults: {
        isLoading: false,
        results: conversations,
      },
      contactResults: { isLoading: false, results: contacts },
      messageResults: { isLoading: false, results: [] },
      searchTerm: 'foo',
    });

    assert.deepEqual(helper.getRow(0), {
      type: RowType.Header,
      i18nKey: 'conversationsHeader',
    });
    assert.deepEqual(helper.getRow(1), {
      type: RowType.Conversation,
      conversation: conversations[0],
    });
    assert.deepEqual(helper.getRow(2), {
      type: RowType.Conversation,
      conversation: conversations[1],
    });
    assert.deepEqual(helper.getRow(3), {
      type: RowType.Header,
      i18nKey: 'contactsHeader',
    });
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
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }),
        new LeftPaneSearchHelper({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation(), fakeConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'foo',
        }),
        new LeftPaneSearchHelper({
          conversationResults: { isLoading: true },
          contactResults: { isLoading: true },
          messageResults: { isLoading: false, results: [fakeMessage()] },
          searchTerm: 'foo',
        }),
      ];

      helpers.forEach(helper => {
        assert.isFalse(helper.isScrollable());
      });
    });

    it('returns true if all results have loaded', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: [fakeConversation(), fakeConversation()],
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
        searchTerm: 'foo',
      });
      assert.isTrue(helper.isScrollable());
    });
  });

  describe('shouldRecomputeRowHeights', () => {
    it("returns false if the number of results doesn't change", () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: [fakeConversation(), fakeConversation()],
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: {
          isLoading: false,
          results: [fakeMessage(), fakeMessage(), fakeMessage()],
        },
        searchTerm: 'foo',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation(), fakeConversation()],
          },
          contactResults: { isLoading: false, results: [] },
          messageResults: {
            isLoading: false,
            results: [fakeMessage(), fakeMessage(), fakeMessage()],
          },
          searchTerm: 'bar',
        })
      );
    });

    it('returns false when a section completes loading, but not all sections are done (because the pane is still loading overall)', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchTerm: 'foo',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'bar',
        })
      );
    });

    it('returns true when all sections finish loading', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: false, results: [fakeMessage()] },
        searchTerm: 'foo',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation(), fakeConversation()],
          },
          contactResults: { isLoading: false, results: [] },
          messageResults: { isLoading: false, results: [fakeMessage()] },
          searchTerm: 'foo',
        })
      );
    });

    it('returns true if the number of results in a section changes', () => {
      const helper = new LeftPaneSearchHelper({
        conversationResults: {
          isLoading: false,
          results: [fakeConversation(), fakeConversation()],
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
        searchTerm: 'foo',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          conversationResults: {
            isLoading: false,
            results: [fakeConversation()],
          },
          contactResults: { isLoading: true },
          messageResults: { isLoading: true },
          searchTerm: 'bar',
        })
      );
    });
  });
});
