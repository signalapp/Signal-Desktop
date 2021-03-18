// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { createSelector } from 'reselect';

import { deconstructLookup } from '../../util/deconstructLookup';

import { StateType } from '../reducer';

import {
  MessageSearchResultLookupType,
  MessageSearchResultType,
  SearchStateType,
} from '../ducks/search';
import {
  ConversationLookupType,
  ConversationType,
} from '../ducks/conversations';

import { LeftPaneSearchPropsType } from '../../components/leftPane/LeftPaneSearchHelper';
import { PropsDataType as MessageSearchResultPropsDataType } from '../../components/conversationList/MessageSearchResult';

import { getUserConversationId } from './user';
import {
  GetConversationByIdType,
  getConversationLookup,
  getConversationSelector,
} from './conversations';

import { BodyRangeType } from '../../types/Util';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = createSelector(
  getSearch,
  (state: SearchStateType): string => state.query
);

export const getSelectedMessage = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.selectedMessage
);

export const getSearchConversationId = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.searchConversationId
);

export const getSearchConversationName = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.searchConversationName
);

export const getStartSearchCounter = createSelector(
  getSearch,
  (state: SearchStateType): number => state.startSearchCounter
);

export const isSearching = createSelector(
  getQuery,
  (query: string): boolean => query.trim().length > 1
);

export const getMessageSearchResultLookup = createSelector(
  getSearch,
  (state: SearchStateType) => state.messageLookup
);

export const getSearchResults = createSelector(
  [getSearch, getConversationLookup],
  (
    state: SearchStateType,
    conversationLookup: ConversationLookupType
  ): LeftPaneSearchPropsType => {
    const {
      contactIds,
      conversationIds,
      discussionsLoading,
      messageIds,
      messageLookup,
      messagesLoading,
      searchConversationName,
    } = state;

    return {
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
    };
  }
);

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
type CachedMessageSearchResultSelectorType = (
  message: MessageSearchResultType,
  from: ConversationType,
  to: ConversationType,
  searchConversationId?: string,
  selectedMessageId?: string
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
        selectedMessageId?: string
      ) => {
        const bodyRanges = message.bodyRanges || [];
        return {
          from,
          to,

          id: message.id,
          conversationId: message.conversationId,
          sentAt: message.sent_at,
          snippet: message.snippet,
          bodyRanges: bodyRanges.map((bodyRange: BodyRangeType) => {
            const conversation = conversationSelector(bodyRange.mentionUuid);

            return {
              ...bodyRange,
              replacementText: conversation.title,
            };
          }),
          body: message.body,

          isSelected: Boolean(
            selectedMessageId && message.id === selectedMessageId
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
    selectedMessageId: string | undefined,
    conversationSelector: GetConversationByIdType,
    searchConversationId: string | undefined,
    ourConversationId: string
  ): GetMessageSearchResultByIdType => {
    return (id: string) => {
      const message = messageSearchResultLookup[id];
      if (!message) {
        window.log.warn(
          `getMessageSearchResultSelector: messageSearchResultLookup was missing id ${id}`
        );
        return undefined;
      }

      const { conversationId, source, sourceUuid, type } = message;
      let from: ConversationType;
      let to: ConversationType;

      if (type === 'incoming') {
        from = conversationSelector(sourceUuid || source);
        to = conversationSelector(conversationId);
      } else if (type === 'outgoing') {
        from = conversationSelector(ourConversationId);
        to = conversationSelector(conversationId);
      } else {
        window.log.warn(
          `getMessageSearchResultSelector: Got unexpected type ${type}`
        );
        return undefined;
      }

      return messageSearchResultSelector(
        message,
        from,
        to,
        searchConversationId,
        selectedMessageId
      );
    };
  }
);
