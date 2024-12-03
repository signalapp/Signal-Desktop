// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { createSelector } from 'reselect';

import { deconstructLookup } from '../../util/deconstructLookup';

import type { StateType } from '../reducer';

import type {
  MessageSearchResultLookupType,
  MessageSearchResultType,
  SearchStateType,
} from '../ducks/search';
import type {
  ConversationLookupType,
  ConversationType,
} from '../ducks/conversations';

import type { LeftPaneSearchPropsType } from '../../components/leftPane/LeftPaneSearchHelper';
import type { PropsDataType as MessageSearchResultPropsDataType } from '../../components/conversationList/MessageSearchResult';

import { getIntl, getUserConversationId } from './user';
import type { GetConversationByIdType } from './conversations';
import {
  getConversationLookup,
  getConversationSelector,
  getSelectedConversationId,
} from './conversations';

import { hydrateRanges } from '../../types/BodyRange';
import * as log from '../../logging/log';
import { getOwn } from '../../util/getOwn';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getFilterByUnread = createSelector(
  getSearch,
  (state: SearchStateType): boolean => state.filterByUnread
);

export const getQuery = createSelector(
  getSearch,
  (state: SearchStateType): string => state.query
);

export const getSelectedMessage = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.targetedMessage
);

const getSearchConversationId = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.searchConversationId
);

export const getIsSearchingInAConversation = createSelector(
  getSearchConversationId,
  Boolean
);

export const getIsSearchingGlobally = createSelector(
  getSearch,
  (state: SearchStateType): boolean => Boolean(state.globalSearch)
);

export const getIsSearching = createSelector(
  getIsSearchingInAConversation,
  getIsSearchingGlobally,
  (isSearchingInAConversation, isSearchingGlobally): boolean =>
    isSearchingInAConversation || isSearchingGlobally
);

export const getSearchConversation = createSelector(
  getSearchConversationId,
  getConversationLookup,
  (searchConversationId, conversationLookup): undefined | ConversationType =>
    searchConversationId
      ? getOwn(conversationLookup, searchConversationId)
      : undefined
);

export const getSearchConversationName = createSelector(
  getSearchConversation,
  getIntl,
  (conversation, i18n): undefined | string => {
    if (!conversation) {
      return undefined;
    }
    return conversation.isMe ? i18n('icu:noteToSelf') : conversation.title;
  }
);

export const getStartSearchCounter = createSelector(
  getSearch,
  (state: SearchStateType): number => state.startSearchCounter
);

export const getHasSearchQuery = createSelector(
  getQuery,
  (query: string): boolean => query.trim().length > 0
);

export const getIsActivelySearching = createSelector(
  [getFilterByUnread, getHasSearchQuery],
  (filterByUnread: boolean, hasSearchQuery: boolean): boolean =>
    filterByUnread || hasSearchQuery
);

export const getMessageSearchResultLookup = createSelector(
  getSearch,
  (state: SearchStateType) => state.messageLookup
);

export const getSearchResults = createSelector(
  [
    getSearch,
    getSearchConversationName,
    getConversationLookup,
    getSelectedConversationId,
  ],
  (
    state: SearchStateType,
    searchConversationName,
    conversationLookup: ConversationLookupType,
    selectedConversationId: string | undefined
  ): Pick<
    LeftPaneSearchPropsType,
    | 'conversationResults'
    | 'contactResults'
    | 'messageResults'
    | 'searchConversationName'
    | 'searchTerm'
    | 'filterByUnread'
  > => {
    const {
      contactIds,
      conversationIds,
      discussionsLoading,
      messageIds,
      messageLookup,
      messagesLoading,
    } = state;

    const searchResults: ReturnType<typeof getSearchResults> = {
      conversationResults: discussionsLoading
        ? { isLoading: true }
        : {
            isLoading: false,
            results: deconstructLookup(conversationLookup, conversationIds),
          },
      contactResults: discussionsLoading
        ? { isLoading: true }
        : {
            isLoading: false,
            results: deconstructLookup(conversationLookup, contactIds),
          },
      messageResults: messagesLoading
        ? { isLoading: true }
        : {
            isLoading: false,
            results: deconstructLookup(messageLookup, messageIds),
          },
      searchConversationName,
      searchTerm: state.query,
      filterByUnread: state.filterByUnread,
    };

    if (
      state.filterByUnread &&
      searchResults.conversationResults.isLoading === false
    ) {
      searchResults.conversationResults.results =
        searchResults.conversationResults.results.map(conversation => {
          return {
            ...conversation,
            isSelected: selectedConversationId === conversation.id,
          };
        });
    }

    return searchResults;
  }
);

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
type CachedMessageSearchResultSelectorType = (
  message: MessageSearchResultType,
  from: ConversationType,
  to: ConversationType,
  searchConversationId?: string,
  targetedMessageId?: string
) => MessageSearchResultPropsDataType;

export const getCachedSelectorForMessageSearchResult = createSelector(
  getUserConversationId,
  getConversationSelector,
  (
    _,
    conversationSelector: GetConversationByIdType
  ): CachedMessageSearchResultSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(
      (
        message: MessageSearchResultType,
        from: ConversationType,
        to: ConversationType,
        searchConversationId?: string,
        targetedMessageId?: string
      ) => {
        return {
          from,
          to,

          id: message.id,
          conversationId: message.conversationId,
          sentAt: message.sent_at,
          snippet: message.snippet || '',
          bodyRanges:
            hydrateRanges(message.bodyRanges, conversationSelector) || [],
          body: message.body || '',

          isSelected: Boolean(
            targetedMessageId && message.id === targetedMessageId
          ),
          isSearchingInConversation: Boolean(searchConversationId),
        };
      },
      { max: 500 }
    );
  }
);

type GetMessageSearchResultByIdType = (
  id: string
) => MessageSearchResultPropsDataType | undefined;

export const getMessageSearchResultSelector = createSelector(
  getCachedSelectorForMessageSearchResult,
  getMessageSearchResultLookup,
  getSelectedMessage,
  getConversationSelector,
  getSearchConversationId,
  getUserConversationId,
  (
    messageSearchResultSelector: CachedMessageSearchResultSelectorType,
    messageSearchResultLookup: MessageSearchResultLookupType,
    targetedMessageId: string | undefined,
    conversationSelector: GetConversationByIdType,
    searchConversationId: string | undefined,
    ourConversationId: string | undefined
  ): GetMessageSearchResultByIdType => {
    return (id: string) => {
      const message = messageSearchResultLookup[id];
      if (!message) {
        log.warn(
          `getMessageSearchResultSelector: messageSearchResultLookup was missing id ${id}`
        );
        return undefined;
      }

      const { conversationId, source, sourceServiceId, type } = message;
      let from: ConversationType;
      let to: ConversationType;

      if (type === 'incoming') {
        from = conversationSelector(sourceServiceId || source);
        to = conversationSelector(conversationId);
        if (from === to) {
          to = conversationSelector(ourConversationId);
        }
      } else if (type === 'outgoing') {
        from = conversationSelector(ourConversationId);
        to = conversationSelector(conversationId);
      } else {
        log.warn(`getMessageSearchResultSelector: Got unexpected type ${type}`);
        return undefined;
      }

      return messageSearchResultSelector(
        message,
        from,
        to,
        searchConversationId,
        targetedMessageId
      );
    };
  }
);
