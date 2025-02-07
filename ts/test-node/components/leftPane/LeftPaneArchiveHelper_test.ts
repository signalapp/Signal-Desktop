// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { LeftPaneSearchHelper } from '../../../components/leftPane/LeftPaneSearchHelper';

import { LeftPaneArchiveHelper } from '../../../components/leftPane/LeftPaneArchiveHelper';

describe('LeftPaneArchiveHelper', () => {
  let sandbox: sinon.SinonSandbox;

  const defaults = {
    archivedConversations: [],
    isSearchingGlobally: false,
    searchConversation: undefined,
    searchTerm: '',
    startSearchCounter: 0,
  };

  const searchingDefaults = {
    ...defaults,
    searchConversation: getDefaultConversation(),
    conversationResults: { isLoading: false, results: [] },
    contactResults: { isLoading: false, results: [] },
    messageResults: { isLoading: false, results: [] },
    searchTerm: 'foo',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBackAction', () => {
    it('returns the "show inbox" action', () => {
      const showInbox = sinon.fake();
      const helper = new LeftPaneArchiveHelper(defaults);

      assert.strictEqual(helper.getBackAction({ showInbox }), showInbox);
    });
  });

  describe('getRowCount', () => {
    it('returns the number of archived conversations', () => {
      assert.strictEqual(new LeftPaneArchiveHelper(defaults).getRowCount(), 0);
      assert.strictEqual(
        new LeftPaneArchiveHelper({
          ...defaults,
          archivedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        }).getRowCount(),
        2
      );
    });

    it('defers to the search helper if searching', () => {
      sandbox.stub(LeftPaneSearchHelper.prototype, 'getRowCount').returns(123);
      assert.strictEqual(
        new LeftPaneArchiveHelper(searchingDefaults).getRowCount(),
        123
      );
    });
  });

  describe('getRowIndexToScrollTo', () => {
    it('returns undefined if no conversation is selected', () => {
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.isUndefined(helper.getRowIndexToScrollTo(undefined));
    });

    it('returns undefined if the selected conversation is not pinned or non-pinned', () => {
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.isUndefined(helper.getRowIndexToScrollTo(uuid()));
    });

    it("returns the archived conversation's index", () => {
      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations,
      });

      assert.strictEqual(
        helper.getRowIndexToScrollTo(archivedConversations[0].id),
        0
      );
      assert.strictEqual(
        helper.getRowIndexToScrollTo(archivedConversations[1].id),
        1
      );
    });

    it('defers to the search helper if searching', () => {
      sandbox
        .stub(LeftPaneSearchHelper.prototype, 'getRowIndexToScrollTo')
        .returns(123);

      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.strictEqual(
        helper.getRowIndexToScrollTo(archivedConversations[0].id),
        123
      );
    });
  });

  describe('getRow', () => {
    it('returns each conversation as a row', () => {
      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations,
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Conversation,
        conversation: archivedConversations[0],
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Conversation,
        conversation: archivedConversations[1],
      });
    });

    it('defers to the search helper if searching', () => {
      sandbox
        .stub(LeftPaneSearchHelper.prototype, 'getRow')
        .returns({ type: RowType.SearchResultsLoadingFakeHeader });

      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.deepEqual(helper.getRow(0), {
        type: RowType.SearchResultsLoadingFakeHeader,
      });
    });
  });

  describe('getConversationAndMessageAtIndex', () => {
    it('returns the conversation at the given index when it exists', () => {
      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations,
      });

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
      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations,
      });

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
      const helper = new LeftPaneArchiveHelper(defaults);

      assert.isUndefined(helper.getConversationAndMessageAtIndex(0));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(1));
      assert.isUndefined(helper.getConversationAndMessageAtIndex(-1));
    });

    it('defers to the search helper if searching', () => {
      sandbox
        .stub(
          LeftPaneSearchHelper.prototype,
          'getConversationAndMessageAtIndex'
        )
        .returns({ conversationId: 'abc123' });

      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.deepEqual(helper.getConversationAndMessageAtIndex(999), {
        conversationId: 'abc123',
      });
    });
  });

  describe('getConversationAndMessageInDirection', () => {
    it('returns the next conversation when searching downward', () => {
      const archivedConversations = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations,
      });

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

    it('defers to the search helper if searching', () => {
      sandbox
        .stub(
          LeftPaneSearchHelper.prototype,
          'getConversationAndMessageInDirection'
        )
        .returns({ conversationId: 'abc123' });

      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.deepEqual(
        helper.getConversationAndMessageInDirection(
          {
            direction: FindDirection.Down,
            unreadOnly: false,
          },
          getDefaultConversation().id,
          undefined
        ),
        {
          conversationId: 'abc123',
        }
      );
    });
  });

  describe('shouldRecomputeRowHeights', () => {
    it('returns false when not searching because row heights are constant', () => {
      const helper = new LeftPaneArchiveHelper({
        ...defaults,
        archivedConversations: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...defaults,
          archivedConversations: [getDefaultConversation()],
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          ...defaults,
          archivedConversations: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        })
      );
    });

    it('returns true when going from searching → not searching', () => {
      const helper = new LeftPaneArchiveHelper(defaults);

      assert.isTrue(helper.shouldRecomputeRowHeights(searchingDefaults));
    });

    it('returns true when going from not searching → searching', () => {
      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.isTrue(helper.shouldRecomputeRowHeights(defaults));
    });

    it('defers to the search helper if searching', () => {
      sandbox
        .stub(LeftPaneSearchHelper.prototype, 'shouldRecomputeRowHeights')
        .returns(true);

      const helper = new LeftPaneArchiveHelper(searchingDefaults);

      assert.isTrue(helper.shouldRecomputeRowHeights(searchingDefaults));
    });
  });
});
