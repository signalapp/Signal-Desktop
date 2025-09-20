// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getEmptyState, reducer } from '../../../state/ducks/search';

describe('both/state/ducks/search', () => {
  describe('REMOVE_CONVERSATION_FILTER', () => {
    it('clears searchConversationId but preserves search term', () => {
      const initialState = {
        ...getEmptyState(),
        query: 'test search',
        searchConversationId: 'conversation-123',
      };

      const action = {
        type: 'REMOVE_CONVERSATION_FILTER' as const,
        payload: null,
      };

      const nextState = reducer(initialState, action);

      // Should clear the conversation filter
      assert.isUndefined(nextState.searchConversationId);

      // Should preserve the search term
      assert.equal(nextState.query, 'test search');
    });

    it('handles state with no search filter', () => {
      const initialState = {
        ...getEmptyState(),
        query: 'test search',
        searchConversationId: undefined,
      };

      const action = {
        type: 'REMOVE_CONVERSATION_FILTER' as const,
        payload: null,
      };

      const nextState = reducer(initialState, action);

      // Should remain unchanged
      assert.isUndefined(nextState.searchConversationId);
      assert.equal(nextState.query, 'test search');
    });
  });
});
