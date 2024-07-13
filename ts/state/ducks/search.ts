// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { debounce, omit, reject } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type {
  ClientSearchResultMessageType,
  ClientInterface,
} from '../../sql/Interface';
import dataInterface from '../../sql/Client';
import { makeLookup } from '../../util/makeLookup';
import { isNotNil } from '../../util/isNotNil';
import type { ServiceIdString } from '../../types/ServiceId';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

import type {
  ConversationType,
  ConversationUnloadedActionType,
  MessageDeletedActionType,
  RemoveAllConversationsActionType,
  TargetedConversationChangedActionType,
  ShowArchivedConversationsActionType,
  MessageType,
} from './conversations';
import { getQuery, getSearchConversation } from '../selectors/search';
import { getAllConversations } from '../selectors/conversations';
import {
  getIntl,
  getRegionCode,
  getUserConversationId,
} from '../selectors/user';
import { strictAssert } from '../../util/assert';
import {
  CONVERSATION_UNLOADED,
  TARGETED_CONVERSATION_CHANGED,
} from './conversations';
import { removeDiacritics } from '../../util/removeDiacritics';
import * as log from '../../logging/log';
import { searchConversationTitles } from '../../util/searchConversationTitles';
import { isDirectConversation } from '../../util/whatTypeOfConversation';

const { searchMessages: dataSearchMessages }: ClientInterface = dataInterface;

// State

export type MessageSearchResultType = ReadonlyDeep<
  MessageType & {
    snippet?: string;
  }
>;

export type MessageSearchResultLookupType = ReadonlyDeep<{
  [id: string]: MessageSearchResultType;
}>;

export type SearchStateType = ReadonlyDeep<{
  startSearchCounter: number;
  searchConversationId?: string;
  globalSearch?: boolean;
  contactIds: Array<string>;
  conversationIds: Array<string>;
  query: string;
  messageIds: Array<string>;
  // We do store message data to pass through the selector
  messageLookup: MessageSearchResultLookupType;
  targetedMessage?: string;
  // Loading state
  discussionsLoading: boolean;
  messagesLoading: boolean;
}>;

// Actions

type SearchMessagesResultsFulfilledActionType = ReadonlyDeep<{
  type: 'SEARCH_MESSAGES_RESULTS_FULFILLED';
  payload: {
    messages: Array<MessageSearchResultType>;
    query: string;
  };
}>;
type SearchDiscussionsResultsFulfilledActionType = ReadonlyDeep<{
  type: 'SEARCH_DISCUSSIONS_RESULTS_FULFILLED';
  payload: {
    conversationIds: Array<string>;
    contactIds: Array<string>;
    query: string;
  };
}>;
type UpdateSearchTermActionType = ReadonlyDeep<{
  type: 'SEARCH_UPDATE';
  payload: {
    query: string;
  };
}>;
type StartSearchActionType = ReadonlyDeep<{
  type: 'SEARCH_START';
  payload: { globalSearch: boolean };
}>;
type ClearSearchActionType = ReadonlyDeep<{
  type: 'SEARCH_CLEAR';
  payload: null;
}>;
type ClearConversationSearchActionType = ReadonlyDeep<{
  type: 'CLEAR_CONVERSATION_SEARCH';
  payload: null;
}>;
type SearchInConversationActionType = ReadonlyDeep<{
  type: 'SEARCH_IN_CONVERSATION';
  payload: { searchConversationId: string };
}>;

export type SearchActionType = ReadonlyDeep<
  | SearchMessagesResultsFulfilledActionType
  | SearchDiscussionsResultsFulfilledActionType
  | UpdateSearchTermActionType
  | StartSearchActionType
  | ClearSearchActionType
  | ClearConversationSearchActionType
  | SearchInConversationActionType
  | MessageDeletedActionType
  | RemoveAllConversationsActionType
  | TargetedConversationChangedActionType
  | ShowArchivedConversationsActionType
  | ConversationUnloadedActionType
>;

// Action Creators

export const actions = {
  startSearch,
  clearSearch,
  clearConversationSearch,
  searchInConversation,
  updateSearchTerm,
};

export const useSearchActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function startSearch(): StartSearchActionType {
  return {
    type: 'SEARCH_START',
    payload: { globalSearch: true },
  };
}
function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}
function clearConversationSearch(): ClearConversationSearchActionType {
  return {
    type: 'CLEAR_CONVERSATION_SEARCH',
    payload: null,
  };
}
function searchInConversation(
  searchConversationId: string
): SearchInConversationActionType {
  return {
    type: 'SEARCH_IN_CONVERSATION',
    payload: { searchConversationId },
  };
}

function updateSearchTerm(
  query: string
): ThunkAction<void, RootStateType, unknown, UpdateSearchTermActionType> {
  return (dispatch, getState) => {
    dispatch({
      type: 'SEARCH_UPDATE',
      payload: { query },
    });

    const state = getState();
    const ourConversationId = getUserConversationId(state);
    strictAssert(
      ourConversationId,
      'updateSearchTerm our conversation is missing'
    );

    const i18n = getIntl(state);

    doSearch({
      dispatch,
      allConversations: getAllConversations(state),
      regionCode: getRegionCode(state),
      noteToSelf: i18n('icu:noteToSelf').toLowerCase(),
      ourConversationId,
      query: getQuery(state),
      searchConversationId: getSearchConversation(state)?.id,
    });
  };
}

const doSearch = debounce(
  ({
    dispatch,
    allConversations,
    regionCode,
    noteToSelf,
    ourConversationId,
    query,
    searchConversationId,
  }: Readonly<{
    dispatch: ThunkDispatch<
      RootStateType,
      unknown,
      | SearchMessagesResultsFulfilledActionType
      | SearchDiscussionsResultsFulfilledActionType
    >;
    allConversations: ReadonlyArray<ConversationType>;
    noteToSelf: string;
    regionCode: string | undefined;
    ourConversationId: string;
    query: string;
    searchConversationId: undefined | string;
  }>) => {
    if (!query) {
      return;
    }

    // Limit the number of contacts to something reasonable
    const MAX_MATCHING_CONTACTS = 100;

    void (async () => {
      const segmenter = new Intl.Segmenter([], { granularity: 'word' });
      const queryWords = [...segmenter.segment(query)]
        .filter(word => word.isWordLike)
        .map(word => word.segment);
      const contactServiceIdsMatchingQuery = searchConversationTitles(
        allConversations,
        queryWords
      )
        .filter(conversation => isDirectConversation(conversation))
        .map(conversation => conversation.serviceId)
        .filter(isNotNil)
        .slice(0, MAX_MATCHING_CONTACTS);

      const messages = await queryMessages({
        query,
        searchConversationId,
        contactServiceIdsMatchingQuery,
      });

      dispatch({
        type: 'SEARCH_MESSAGES_RESULTS_FULFILLED',
        payload: {
          messages,
          query,
        },
      });
    })();

    if (!searchConversationId) {
      void (async () => {
        const { conversationIds, contactIds } =
          await queryConversationsAndContacts(query, {
            ourConversationId,
            noteToSelf,
            regionCode,
            allConversations,
          });

        dispatch({
          type: 'SEARCH_DISCUSSIONS_RESULTS_FULFILLED',
          payload: {
            conversationIds,
            contactIds,
            query,
          },
        });
      })();
    }
  },
  200
);

async function queryMessages({
  query,
  searchConversationId,
  contactServiceIdsMatchingQuery,
}: {
  query: string;
  searchConversationId?: string;
  contactServiceIdsMatchingQuery?: Array<ServiceIdString>;
}): Promise<Array<ClientSearchResultMessageType>> {
  try {
    if (query.length === 0) {
      return [];
    }

    if (searchConversationId) {
      return dataSearchMessages({
        query,
        conversationId: searchConversationId,
        contactServiceIdsMatchingQuery,
      });
    }

    return dataSearchMessages({
      query,
      contactServiceIdsMatchingQuery,
    });
  } catch (e) {
    return [];
  }
}

async function queryConversationsAndContacts(
  query: string,
  options: {
    ourConversationId: string;
    noteToSelf: string;
    regionCode: string | undefined;
    allConversations: ReadonlyArray<ConversationType>;
  }
): Promise<{
  contactIds: Array<string>;
  conversationIds: Array<string>;
}> {
  const { ourConversationId, noteToSelf, regionCode, allConversations } =
    options;

  const normalizedQuery = removeDiacritics(query);

  const visibleConversations = allConversations.filter(
    ({ activeAt, removalStage }) => {
      return activeAt != null || removalStage == null;
    }
  );

  const searchResults: Array<ConversationType> = filterAndSortConversations(
    visibleConversations,
    normalizedQuery,
    regionCode
  );

  // Split into two groups - active conversations and items just from address book
  let conversationIds: Array<string> = [];
  let contactIds: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];

    if (conversation.type === 'direct' && !conversation.lastMessage) {
      contactIds.push(conversation.id);
    } else {
      conversationIds.push(conversation.id);
    }
  }

  // Inject synthetic Note to Self entry if query matches localized 'Note to Self'
  if (noteToSelf.indexOf(query.toLowerCase()) !== -1) {
    // ensure that we don't have duplicates in our results
    contactIds = contactIds.filter(id => id !== ourConversationId);
    conversationIds = conversationIds.filter(id => id !== ourConversationId);

    contactIds.unshift(ourConversationId);
  }

  return { conversationIds, contactIds };
}

// Reducer

export function getEmptyState(): SearchStateType {
  return {
    startSearchCounter: 0,
    query: '',
    messageIds: [],
    messageLookup: {},
    conversationIds: [],
    contactIds: [],
    discussionsLoading: false,
    messagesLoading: false,
  };
}

export function reducer(
  state: Readonly<SearchStateType> = getEmptyState(),
  action: Readonly<SearchActionType>
): SearchStateType {
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    log.info('search: show archived conversations, clearing message lookup');
    return getEmptyState();
  }

  if (action.type === 'SEARCH_START') {
    return {
      ...state,
      searchConversationId: undefined,
      globalSearch: true,
      startSearchCounter: state.startSearchCounter + 1,
    };
  }

  if (action.type === 'SEARCH_CLEAR') {
    log.info('search: cleared, clearing message lookup');

    return {
      ...getEmptyState(),
      startSearchCounter: state.startSearchCounter,
    };
  }

  if (action.type === 'SEARCH_UPDATE') {
    const { payload } = action;
    const { query } = payload;

    const hasQuery = Boolean(query);
    const isWithinConversation = Boolean(state.searchConversationId);

    return {
      ...state,
      query,
      messagesLoading: hasQuery,
      ...(hasQuery
        ? {
            messageIds: [],
            messageLookup: {},
            discussionsLoading: !isWithinConversation,
            contactIds: [],
            conversationIds: [],
          }
        : {}),
    };
  }

  if (action.type === 'SEARCH_IN_CONVERSATION') {
    const { payload } = action;
    const { searchConversationId } = payload;

    if (searchConversationId === state.searchConversationId) {
      return {
        ...state,
        startSearchCounter: state.startSearchCounter + 1,
      };
    }

    log.info('search: searching in new conversation, clearing message lookup');

    return {
      ...getEmptyState(),
      searchConversationId,
      startSearchCounter: state.startSearchCounter + 1,
    };
  }
  if (action.type === 'CLEAR_CONVERSATION_SEARCH') {
    const { searchConversationId } = state;

    log.info('search: cleared conversation search, clearing message lookup');

    return {
      ...getEmptyState(),
      searchConversationId,
    };
  }

  if (action.type === 'SEARCH_MESSAGES_RESULTS_FULFILLED') {
    const { payload } = action;
    const { messages, query } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      log.info('search: query mismatch, ignoring message results');
      return state;
    }

    log.info('search: got new messages, updating message lookup');

    const messageIds = messages.map(message => message.id);

    return {
      ...state,
      query,
      messageIds,
      messageLookup: makeLookup(messages, 'id'),
      messagesLoading: false,
    };
  }

  if (action.type === 'SEARCH_DISCUSSIONS_RESULTS_FULFILLED') {
    const { payload } = action;
    const { contactIds, conversationIds, query } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      log.info('search: query mismatch, ignoring message results');
      return state;
    }

    return {
      ...state,
      contactIds,
      conversationIds,
      discussionsLoading: false,
    };
  }

  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === TARGETED_CONVERSATION_CHANGED) {
    const { payload } = action;
    const { conversationId, messageId } = payload;
    const { searchConversationId } = state;

    if (searchConversationId && searchConversationId !== conversationId) {
      log.info(
        'search: targeted conversation changed, clearing message lookup'
      );
      return getEmptyState();
    }

    return {
      ...state,
      targetedMessage: messageId,
    };
  }

  if (action.type === CONVERSATION_UNLOADED) {
    const { payload } = action;
    const { conversationId } = payload;
    const { searchConversationId } = state;

    if (searchConversationId && searchConversationId === conversationId) {
      log.info(
        'search: searched conversation unloaded, clearing message lookup'
      );
      return getEmptyState();
    }

    return state;
  }

  if (action.type === 'MESSAGE_DELETED') {
    const { messageIds, messageLookup } = state;
    if (!messageIds || messageIds.length < 1) {
      return state;
    }

    const { payload } = action;
    const { id } = payload;

    log.info('search: message deleted, removing from message lookup');

    return {
      ...state,
      messageIds: reject(messageIds, messageId => id === messageId),
      messageLookup: omit(messageLookup, id),
    };
  }

  return state;
}
