// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { debounce, omit, reject } from 'lodash';

import type { ReadonlyDeep } from 'type-fest';
import type { StateType as RootStateType } from '../reducer';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type { ClientSearchResultMessageType } from '../../sql/Interface';
import { DataReader } from '../../sql/Client';
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
  ConversationLookupType,
} from './conversations';
import {
  getFilterByUnread,
  getIsActivelySearching,
  getQuery,
  getSearchConversation,
} from '../selectors/search';
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
import {
  countConversationUnreadStats,
  hasUnread,
} from '../../util/countUnreadStats';

const { searchMessages: dataSearchMessages } = DataReader;

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
  filterByUnread: boolean;
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
  payload: null;
}>;
type ClearSearchQueryActionType = ReadonlyDeep<{
  type: 'SEARCH_QUERY_CLEAR';
  payload: null;
}>;
type ClearConversationSearchActionType = ReadonlyDeep<{
  type: 'CLEAR_CONVERSATION_SEARCH';
  payload: null;
}>;
type EndSearchActionType = ReadonlyDeep<{
  type: 'SEARCH_END';
  payload: null;
}>;
type EndConversationSearchActionType = ReadonlyDeep<{
  type: 'END_CONVERSATION_SEARCH';
  payload: null;
}>;
type SearchInConversationActionType = ReadonlyDeep<{
  type: 'SEARCH_IN_CONVERSATION';
  payload: { searchConversationId: string };
}>;

type UpdateFilterByUnreadActionType = ReadonlyDeep<{
  type: 'FILTER_BY_UNREAD_UPDATE';
  payload: { enabled: boolean };
}>;

type RefreshSearchActionType = ReadonlyDeep<{
  type: 'SEARCH_REFRESH';
  payload: null;
}>;

type MaybeRemoveReadConversationsActionType = ReadonlyDeep<{
  type: 'MAYBE_REMOVE_READ_CONVERSATIONS';
  payload: {
    conversations: Array<ConversationType>;
    selectedConversationId: string | undefined;
  };
}>;

export type SearchActionType = ReadonlyDeep<
  | SearchMessagesResultsFulfilledActionType
  | SearchDiscussionsResultsFulfilledActionType
  | UpdateSearchTermActionType
  | StartSearchActionType
  | ClearSearchQueryActionType
  | ClearConversationSearchActionType
  | EndSearchActionType
  | EndConversationSearchActionType
  | SearchInConversationActionType
  | MessageDeletedActionType
  | RemoveAllConversationsActionType
  | TargetedConversationChangedActionType
  | ShowArchivedConversationsActionType
  | ConversationUnloadedActionType
  | UpdateFilterByUnreadActionType
  | RefreshSearchActionType
  | MaybeRemoveReadConversationsActionType
>;

// Action Creators

export const actions = {
  startSearch,
  clearSearchQuery,
  clearConversationSearch,
  endSearch,
  endConversationSearch,
  searchInConversation,
  updateSearchTerm,
  updateFilterByUnread,
  refreshSearch,
  maybeRemoveReadConversations,
  updateSearchResultsOnConversationUpdate,
};

export const useSearchActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function startSearch(): StartSearchActionType {
  return {
    type: 'SEARCH_START',
    payload: null,
  };
}
function clearSearchQuery(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ClearSearchQueryActionType
> {
  return async (dispatch, getState) => {
    dispatch({
      type: 'SEARCH_QUERY_CLEAR',
      payload: null,
    });

    doSearch({
      dispatch,
      state: getState(),
    });
  };
}
function clearConversationSearch(): ClearConversationSearchActionType {
  return {
    type: 'CLEAR_CONVERSATION_SEARCH',
    payload: null,
  };
}
function endSearch(): EndSearchActionType {
  return {
    type: 'SEARCH_END',
    payload: null,
  };
}
function endConversationSearch(): EndConversationSearchActionType {
  return {
    type: 'END_CONVERSATION_SEARCH',
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

function refreshSearch(): ThunkAction<
  void,
  RootStateType,
  unknown,
  RefreshSearchActionType
> {
  return (dispatch, getState) => {
    const state = getState();

    if (!getIsActivelySearching(state)) {
      return;
    }

    dispatch({
      type: 'SEARCH_REFRESH',
      payload: null,
    });

    doSearch({
      dispatch,
      state,
    });
  };
}

function updateSearchResultsOnConversationUpdate(
  oldConversationLookup: ConversationLookupType,
  updatedConversations: Array<ConversationType>
): ThunkAction<
  void,
  RootStateType,
  unknown,
  MaybeRemoveReadConversationsActionType
> {
  return (dispatch, getState) => {
    const state = getState();

    if (!getIsActivelySearching(getState())) {
      return;
    }

    const someConversationsHaveNewMessages = updatedConversations.some(
      conversation => {
        const oldConversation = oldConversationLookup[conversation.id];

        return (
          !oldConversation ||
          oldConversation.lastMessageReceivedAt !==
            conversation.lastMessageReceivedAt
        );
      }
    );

    if (someConversationsHaveNewMessages) {
      dispatch(refreshSearch());
      // A new search will automatically remove read conversations
      return;
    }

    dispatch({
      type: 'MAYBE_REMOVE_READ_CONVERSATIONS',
      payload: {
        conversations: updatedConversations,
        selectedConversationId: state.conversations.selectedConversationId,
      },
    });
  };
}

function shouldRemoveConversationFromUnreadList(
  conversation: ConversationType,
  selectedConversationId: string | undefined,
  state: SearchStateType
): boolean {
  if (
    state.filterByUnread &&
    state.conversationIds.includes(conversation.id) &&
    conversation &&
    (selectedConversationId == null ||
      selectedConversationId !== conversation.id) &&
    !hasUnread(
      countConversationUnreadStats(conversation, { includeMuted: true })
    )
  ) {
    return true;
  }

  return false;
}

function maybeRemoveReadConversations(
  conversationIds: Array<string>
): ThunkAction<
  void,
  RootStateType,
  unknown,
  MaybeRemoveReadConversationsActionType
> {
  return (dispatch, getState) => {
    const {
      conversations: { selectedConversationId, conversationLookup },
    } = getState();

    const conversations = conversationIds
      .map(id => conversationLookup[id])
      .filter(isNotNil);

    dispatch({
      type: 'MAYBE_REMOVE_READ_CONVERSATIONS',
      payload: {
        conversations,
        selectedConversationId,
      },
    });
  };
}

function updateFilterByUnread(
  filterByUnread: boolean
): ThunkAction<void, RootStateType, unknown, UpdateFilterByUnreadActionType> {
  return (dispatch, getState) => {
    dispatch({
      type: 'FILTER_BY_UNREAD_UPDATE',
      payload: {
        enabled: filterByUnread,
      },
    });

    doSearch({
      dispatch,
      state: getState(),
    });
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

    doSearch({
      dispatch,
      state: getState(),
    });
  };
}

const doSearch = debounce(
  ({
    dispatch,
    state,
  }: Readonly<{
    dispatch: ThunkDispatch<
      RootStateType,
      unknown,
      | SearchMessagesResultsFulfilledActionType
      | SearchDiscussionsResultsFulfilledActionType
    >;
    state: RootStateType;
  }>) => {
    if (!getIsActivelySearching(state)) {
      return;
    }

    const query = getQuery(state);
    const filterByUnread = getFilterByUnread(state);
    const i18n = getIntl(state);
    const allConversations = getAllConversations(state);
    const regionCode = getRegionCode(state);
    const noteToSelf = i18n('icu:noteToSelf').toLowerCase();
    const ourConversationId = getUserConversationId(state);
    const searchConversationId = getSearchConversation(state)?.id;

    const { selectedConversationId } = state.conversations;

    strictAssert(ourConversationId, 'doSearch our conversation is missing');

    // Limit the number of contacts to something reasonable
    const MAX_MATCHING_CONTACTS = 100;

    void (async () => {
      if (filterByUnread) {
        dispatch({
          type: 'SEARCH_MESSAGES_RESULTS_FULFILLED',
          payload: {
            messages: [],
            query,
          },
        });
        return;
      }
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
        const selectedConversation: ConversationType | undefined =
          selectedConversationId
            ? state.conversations.conversationLookup[selectedConversationId]
            : undefined;
        const { conversationIds, contactIds } =
          await queryConversationsAndContacts(query, {
            filterByUnread,
            ourConversationId,
            noteToSelf,
            regionCode,
            allConversations,
            /**
             * If filter by unread is enabled, the selected conversation
             * is read, and it's already in the list, we don't want to remove it
             * from the list. It will be removed when the user switches to
             * a different conversation.
             */
            conversationToInject:
              filterByUnread &&
              selectedConversationId &&
              selectedConversation &&
              state.search.conversationIds.includes(selectedConversationId) &&
              !hasUnread(
                countConversationUnreadStats(selectedConversation, {
                  includeMuted: true,
                })
              )
                ? selectedConversation
                : undefined,
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
    if (query.trim().length === 0) {
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
    filterByUnread: boolean;
    ourConversationId: string;
    noteToSelf: string;
    regionCode: string | undefined;
    allConversations: ReadonlyArray<ConversationType>;
    conversationToInject?: ConversationType;
  }
): Promise<{
  contactIds: Array<string>;
  conversationIds: Array<string>;
}> {
  const {
    conversationToInject,
    filterByUnread,
    ourConversationId,
    noteToSelf,
    regionCode,
    allConversations,
  } = options;

  const normalizedQuery = removeDiacritics(query);

  const visibleConversations = allConversations.filter(conversation => {
    const { activeAt, removalStage, isBlocked, messagesDeleted } = conversation;

    if (isDirectConversation(conversation)) {
      // if a conversation has messages (i.e. is not "deleted"), always show it
      if (activeAt != null) {
        return true;
      }

      // Don't show if conversation is empty and the contact is blocked
      if (isBlocked) {
        return false;
      }

      // Don't show if conversation is empty and the contact is removed
      if (removalStage != null) {
        return false;
      }

      // Otherwise, show it
      return true;
    }

    // We don't show groups that were deleted in search results
    return !messagesDeleted;
  });

  const searchResults: Array<ConversationType> = filterAndSortConversations(
    visibleConversations,
    normalizedQuery,
    regionCode,
    filterByUnread,
    conversationToInject
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

  // If it's a query search and query matches part of localized "Note to Self",
  // inject synthetic Note to Self only in the contacts list.
  // If we're filtering by unread, no contacts are shown anyway, so we show it in the
  // normal flow of the conversations list.
  if (!filterByUnread && noteToSelf.indexOf(query.toLowerCase()) !== -1) {
    // ensure that we don't have duplicates in our results
    contactIds = contactIds.filter(id => id !== ourConversationId);
    conversationIds = conversationIds.filter(id => id !== ourConversationId);

    contactIds.unshift(ourConversationId);
  }

  // Don't show contacts in the left pane if we're filtering by unread
  if (filterByUnread) {
    contactIds = [];
  }

  return { conversationIds, contactIds };
}

// Reducer

export function getEmptyState(): SearchStateType {
  return {
    startSearchCounter: 0,
    query: '',
    filterByUnread: false,
    messageIds: [],
    messageLookup: {},
    conversationIds: [],
    contactIds: [],
    discussionsLoading: false,
    messagesLoading: false,
  };
}

function handleSearchUpdate(
  state: SearchStateType,
  params: { query?: string; filterByUnread?: boolean }
): SearchStateType {
  const { query, filterByUnread } = params;

  // Determine the new state values, falling back to existing state if not provided
  const newQuery = query ?? state.query;
  const newFilterByUnread = filterByUnread ?? state.filterByUnread;

  const isValidSearch = newQuery.length > 0 || newFilterByUnread;
  const isWithinConversation = Boolean(state.searchConversationId);

  if (isValidSearch) {
    return {
      ...state,
      query: newQuery,
      filterByUnread: newFilterByUnread,
      messagesLoading: true,
      messageIds: [],
      messageLookup: {},
      discussionsLoading: !isWithinConversation,
      contactIds: [],
      conversationIds: [],
    };
  }

  return {
    ...getEmptyState(),
    startSearchCounter: state.startSearchCounter,
    searchConversationId: state.searchConversationId,
    globalSearch: state.globalSearch,
  };
}

export function reducer(
  state: Readonly<SearchStateType> = getEmptyState(),
  action: Readonly<SearchActionType>
): SearchStateType {
  if (action.type === 'MAYBE_REMOVE_READ_CONVERSATIONS') {
    if (!state.filterByUnread) {
      return state;
    }
    const { conversations, selectedConversationId } = action.payload;

    const conversationIdsToRemove = conversations
      .filter(conversation =>
        shouldRemoveConversationFromUnreadList(
          conversation,
          selectedConversationId,
          state
        )
      )
      .map(conversation => conversation.id);

    if (conversationIdsToRemove.length === 0) {
      return state;
    }

    return {
      ...state,
      conversationIds: state.conversationIds.filter(
        id => !conversationIdsToRemove.includes(id)
      ),
    };
  }
  if (action.type === 'FILTER_BY_UNREAD_UPDATE') {
    return handleSearchUpdate(state, {
      filterByUnread: action.payload.enabled,
    });
  }

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

  if (action.type === 'SEARCH_QUERY_CLEAR') {
    return handleSearchUpdate(state, { query: '' });
  }

  if (action.type === 'SEARCH_END') {
    return {
      ...state,
      globalSearch: Boolean(state.query) && !state.searchConversationId,
    };
  }

  if (action.type === 'SEARCH_UPDATE') {
    return handleSearchUpdate(state, { query: action.payload.query });
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

  if (action.type === 'END_CONVERSATION_SEARCH') {
    return {
      ...getEmptyState(),
      startSearchCounter: state.startSearchCounter + 1,
      globalSearch: true,
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
