// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  ConversationType,
  getEmptyState as getEmptyConversationState,
  MessageType,
} from '../../../state/ducks/conversations';
import { noopAction } from '../../../state/ducks/noop';
import {
  getEmptyState as getEmptySearchState,
  MessageSearchResultType,
} from '../../../state/ducks/search';
import { getEmptyState as getEmptyUserState } from '../../../state/ducks/user';
import {
  getMessageSearchResultSelector,
  getSearchResults,
} from '../../../state/selectors/search';
import { makeLookup } from '../../../util/makeLookup';

import { StateType, reducer as rootReducer } from '../../../state/reducer';

describe('both/state/selectors/search', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function getDefaultMessage(id: string): MessageType {
    return {
      id,
      conversationId: 'conversationId',
      source: 'source',
      sourceUuid: 'sourceUuid',
      type: 'incoming' as const,
      received_at: Date.now(),
      attachments: [],
      sticker: {},
      unread: false,
    };
  }

  function getDefaultSearchMessage(id: string): MessageSearchResultType {
    return {
      ...getDefaultMessage(id),
      body: 'foo bar',
      bodyRanges: [],
      snippet: 'foo bar',
    };
  }

  function getDefaultConversation(id: string): ConversationType {
    return {
      id,
      type: 'direct',
      title: `${id} title`,
    };
  }

  describe('#getMessageSearchResultSelector', () => {
    it('returns undefined if message not found in lookup', () => {
      const state = getEmptyRootState();
      const selector = getMessageSearchResultSelector(state);

      const actual = selector('random-id');

      assert.strictEqual(actual, undefined);
    });

    it('returns undefined if type is unexpected', () => {
      const id = 'message-id';
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          messageLookup: {
            [id]: {
              ...getDefaultMessage(id),
              type: 'keychange' as const,
              snippet: 'snippet',
              body: 'snippet',
              bodyRanges: [],
            },
          },
        },
      };
      const selector = getMessageSearchResultSelector(state);

      const actual = selector(id);

      assert.strictEqual(actual, undefined);
    });

    it('returns incoming message', () => {
      const searchId = 'search-id';
      const fromId = 'from-id';
      const toId = 'to-id';

      const from = getDefaultConversation(fromId);
      const to = getDefaultConversation(toId);

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: {
            [fromId]: from,
            [toId]: to,
          },
        },
        search: {
          ...getEmptySearchState(),
          messageLookup: {
            [searchId]: {
              ...getDefaultMessage(searchId),
              type: 'incoming' as const,
              sourceUuid: fromId,
              conversationId: toId,
              snippet: 'snippet',
              body: 'snippet',
              bodyRanges: [],
            },
          },
        },
      };
      const selector = getMessageSearchResultSelector(state);

      const actual = selector(searchId);
      const expected = {
        from,
        to,

        id: searchId,
        conversationId: toId,
        sentAt: undefined,
        snippet: 'snippet',
        body: 'snippet',
        bodyRanges: [],

        isSelected: false,
        isSearchingInConversation: false,
      };

      assert.deepEqual(actual, expected);
    });
    it('returns outgoing message and caches appropriately', () => {
      const searchId = 'search-id';
      const fromId = 'from-id';
      const toId = 'to-id';

      const from = getDefaultConversation(fromId);
      const to = getDefaultConversation(toId);

      const state = {
        ...getEmptyRootState(),
        user: {
          ...getEmptyUserState(),
          ourConversationId: fromId,
        },
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: {
            [fromId]: from,
            [toId]: to,
          },
        },
        search: {
          ...getEmptySearchState(),
          messageLookup: {
            [searchId]: {
              ...getDefaultMessage(searchId),
              type: 'outgoing' as const,
              conversationId: toId,
              snippet: 'snippet',
              body: 'snippet',
              bodyRanges: [],
            },
          },
        },
      };
      const selector = getMessageSearchResultSelector(state);

      const actual = selector(searchId);
      const expected = {
        from,
        to,

        id: searchId,
        conversationId: toId,
        sentAt: undefined,
        snippet: 'snippet',
        body: 'snippet',
        bodyRanges: [],

        isSelected: false,
        isSearchingInConversation: false,
      };

      assert.deepEqual(actual, expected);

      // Update the conversation lookup, but not the conversations in question
      const secondState = {
        ...state,
        conversations: {
          ...state.conversations,
        },
      };
      const secondSelector = getMessageSearchResultSelector(secondState);
      const secondActual = secondSelector(searchId);

      assert.strictEqual(secondActual, actual);

      // Update a conversation involved in rendering this search result
      const thirdState = {
        ...state,
        conversations: {
          ...state.conversations,
          conversationLookup: {
            ...state.conversations.conversationLookup,
            [fromId]: {
              ...from,
              name: 'new-name',
            },
          },
        },
      };

      const thirdSelector = getMessageSearchResultSelector(thirdState);
      const thirdActual = thirdSelector(searchId);

      assert.notStrictEqual(actual, thirdActual);
    });
  });

  describe('#getSearchResults', () => {
    it("returns loading search results when they're loading", () => {
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          query: 'foo bar',
          discussionsLoading: true,
          messagesLoading: true,
        },
      };

      assert.deepEqual(getSearchResults(state), {
        conversationResults: { isLoading: true },
        contactResults: { isLoading: true },
        messageResults: { isLoading: true },
        searchConversationName: undefined,
        searchTerm: 'foo bar',
      });
    });

    it('returns loaded search results', () => {
      const conversations: Array<ConversationType> = [
        getDefaultConversation('1'),
        getDefaultConversation('2'),
      ];
      const contacts: Array<ConversationType> = [
        getDefaultConversation('3'),
        getDefaultConversation('4'),
        getDefaultConversation('5'),
      ];
      const messages: Array<MessageSearchResultType> = [
        getDefaultSearchMessage('a'),
        getDefaultSearchMessage('b'),
        getDefaultSearchMessage('c'),
      ];

      const getId = ({ id }: Readonly<{ id: string }>) => id;

      const state: StateType = {
        ...getEmptyRootState(),
        conversations: {
          // This test state is invalid, but is good enough for this test.
          ...getEmptyConversationState(),
          conversationLookup: makeLookup([...conversations, ...contacts], 'id'),
        },
        search: {
          ...getEmptySearchState(),
          query: 'foo bar',
          conversationIds: conversations.map(getId),
          contactIds: contacts.map(getId),
          messageIds: messages.map(getId),
          messageLookup: makeLookup(messages, 'id'),
          discussionsLoading: false,
          messagesLoading: false,
        },
      };

      assert.deepEqual(getSearchResults(state), {
        conversationResults: {
          isLoading: false,
          results: conversations,
        },
        contactResults: {
          isLoading: false,
          results: contacts,
        },
        messageResults: {
          isLoading: false,
          results: messages,
        },
        searchConversationName: undefined,
        searchTerm: 'foo bar',
      });
    });
  });
});
