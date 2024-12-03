// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import sinon from 'sinon';

import type {
  ConversationType,
  MessageType,
} from '../../../state/ducks/conversations';
import { getEmptyState as getEmptyConversationState } from '../../../state/ducks/conversations';
import { noopAction } from '../../../state/ducks/noop';
import type { MessageSearchResultType } from '../../../state/ducks/search';
import { getEmptyState as getEmptySearchState } from '../../../state/ducks/search';
import { getEmptyState as getEmptyUserState } from '../../../state/ducks/user';
import {
  getIsSearching,
  getIsSearchingGlobally,
  getIsSearchingInAConversation,
  getMessageSearchResultSelector,
  getSearchResults,
} from '../../../state/selectors/search';
import { makeLookup } from '../../../util/makeLookup';
import { generateAci } from '../../../types/ServiceId';
import {
  getDefaultConversation,
  getDefaultConversationWithServiceId,
} from '../../helpers/getDefaultConversation';
import { ReadStatus } from '../../../messages/MessageReadStatus';

import type { StateType } from '../../../state/reducer';
import { reducer as rootReducer } from '../../../state/reducer';

describe('both/state/selectors/search', () => {
  const NOW = 1_000_000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clock: any;

  beforeEach(() => {
    clock = sinon.useFakeTimers({
      now: NOW,
    });
  });

  afterEach(() => {
    clock.restore();
  });

  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function getDefaultMessage(id: string): MessageType {
    return {
      attachments: [],
      conversationId: 'conversationId',
      id,
      received_at: NOW,
      sent_at: NOW,
      source: 'source',
      sourceServiceId: generateAci(),
      timestamp: NOW,
      type: 'incoming' as const,
      readStatus: ReadStatus.Read,
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

  describe('#getIsSearchingInAConversation', () => {
    it('returns false if not searching in a conversation', () => {
      const state = getEmptyRootState();

      assert.isFalse(getIsSearchingInAConversation(state));
    });

    it('returns true if searching in a conversation', () => {
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          searchConversationId: 'abc123',
          searchConversationName: 'Test Conversation',
        },
      };

      assert.isTrue(getIsSearchingInAConversation(state));
    });
  });

  describe('#getIsSearchingGlobally', () => {
    it('returns false if not searching', () => {
      const state = getEmptyRootState();

      assert.isFalse(getIsSearchingGlobally(state));
    });

    it('returns true if searching globally', () => {
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          globalSearch: true,
        },
      };

      assert.isTrue(getIsSearchingGlobally(state));
    });
  });

  describe('#getIsSearching', () => {
    it('returns false if not searching in any manner', () => {
      const state = getEmptyRootState();

      assert.isFalse(getIsSearching(state));
    });

    it('returns true if searching in a conversation', () => {
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          searchConversationId: 'abc123',
          searchConversationName: 'Test Conversation',
          globalSearch: false,
        },
      };

      assert.isTrue(getIsSearching(state));
    });

    it('returns true if searching globally', () => {
      const state = {
        ...getEmptyRootState(),
        search: {
          ...getEmptySearchState(),
          searchConversationId: undefined,
          globalSearch: true,
        },
      };

      assert.isTrue(getIsSearchingGlobally(state));
    });
  });

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
      const toId = 'to-id';

      const from = getDefaultConversationWithServiceId();
      const to = getDefaultConversation({ id: toId });

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: {
            [from.id]: from,
            [toId]: to,
          },
          conversationsByServiceId: {
            [from.serviceId]: from,
          },
        },
        search: {
          ...getEmptySearchState(),
          messageLookup: {
            [searchId]: {
              ...getDefaultMessage(searchId),
              type: 'incoming' as const,
              sourceServiceId: from.serviceId,
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
        sentAt: NOW,
        snippet: 'snippet',
        body: 'snippet',
        bodyRanges: [],

        isSelected: false,
        isSearchingInConversation: false,
      };

      assert.deepEqual(actual, expected);
    });

    it('returns the correct "from" and "to" when sent to me', () => {
      const searchId = 'search-id';
      const myId = 'my-id';

      const from = getDefaultConversationWithServiceId();
      const toId = from.serviceId;
      const meAsRecipient = getDefaultConversation({ id: myId });

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: {
            [from.id]: from,
            [myId]: meAsRecipient,
          },
          conversationsByServiceId: {
            [from.serviceId]: from,
          },
        },
        ourConversationId: myId,
        search: {
          ...getEmptySearchState(),
          messageLookup: {
            [searchId]: {
              ...getDefaultMessage(searchId),
              type: 'incoming' as const,
              sourceServiceId: from.serviceId,
              conversationId: toId,
              snippet: 'snippet',
              body: 'snippet',
              bodyRanges: [],
            },
          },
        },
        user: {
          ...getEmptyUserState(),
          ourConversationId: myId,
        },
      };
      const selector = getMessageSearchResultSelector(state);

      const actual = selector(searchId);
      assert.deepEqual(actual?.from, from);
      assert.deepEqual(actual?.to, meAsRecipient);
    });

    it('returns outgoing message and caches appropriately', () => {
      const searchId = 'search-id';
      const toId = 'to-id';

      const from = getDefaultConversationWithServiceId();
      const to = getDefaultConversation({ id: toId });

      const state = {
        ...getEmptyRootState(),
        user: {
          ...getEmptyUserState(),
          ourConversationId: from.id,
        },
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: {
            [from.id]: from,
            [toId]: to,
          },
          conversationsByServiceId: {
            [from.serviceId]: from,
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
        sentAt: NOW,
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
          conversationsByServiceId: {
            ...state.conversations.conversationsByServiceId,
            [from.serviceId]: {
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
        filterByUnread: false,
      });
    });

    it('returns loaded search results', () => {
      const conversations: Array<ConversationType> = [
        getDefaultConversation({ id: '1' }),
        getDefaultConversation({ id: '2' }),
      ];
      const contacts: Array<ConversationType> = [
        getDefaultConversation({ id: '3' }),
        getDefaultConversation({ id: '4' }),
        getDefaultConversation({ id: '5' }),
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
        filterByUnread: false,
      });
    });

    it('adds isSelected flag to conversations when filterByUnread is true', () => {
      const conversations: Array<ConversationType> = [
        getDefaultConversation({ id: '1' }),
        getDefaultConversation({ id: 'selected-id' }),
      ];

      const state: StateType = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: makeLookup(conversations, 'id'),
          selectedConversationId: 'selected-id',
        },
        search: {
          ...getEmptySearchState(),
          query: 'foo bar',
          conversationIds: conversations.map(({ id }) => id),
          discussionsLoading: false,
          filterByUnread: true,
        },
      };

      const searchResults = getSearchResults(state);

      assert.deepEqual(searchResults.conversationResults, {
        isLoading: false,
        results: [
          {
            ...conversations[0],
            isSelected: false,
          },
          {
            ...conversations[1],
            isSelected: true,
          },
        ],
      });
    });

    it('does not add isSelected flag to conversations when filterByUnread is false', () => {
      const conversations: Array<ConversationType> = [
        getDefaultConversation({ id: '1' }),
        getDefaultConversation({ id: '2' }),
      ];

      const state: StateType = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyConversationState(),
          conversationLookup: makeLookup(conversations, 'id'),
          selectedConversationId: '2',
        },
        search: {
          ...getEmptySearchState(),
          query: 'foo bar',
          conversationIds: conversations.map(({ id }) => id),
          discussionsLoading: false,
          filterByUnread: false,
        },
      };

      const searchResults = getSearchResults(state);

      assert.deepEqual(searchResults.conversationResults, {
        isLoading: false,
        results: conversations,
      });
    });
  });
});
