// Copyright 2019-2022 Signal Messenger, LLC
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
} from './conversations';

import type { BodyRangeType } from '../../types/Util';
import * as log from '../../logging/log';
import { getOwn } from '../../util/getOwn';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = createSelector(
  getSearch,
  (state: SearchStateType): string => state.query
);

export const getSelectedMessage = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.selectedMessage
);

const getSearchConversationId = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.searchConversationId
);

export const getIsSearchingInAConversation = createSelector(
  getSearchConversationId,
  Boolean
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
    return conversation.isMe ? i18n('noteToSelf') : conversation.title;
  }
);

export const getStartSearchCounter = createSelector(
  getSearch,
  (state: SearchStateType): number => state.startSearchCounter
);

export const isSearching = createSelector(
  getQuery,
  (query: string): boolean => query.trim().length > 0
);

export const getMessageSearchResultLookup = createSelector(
  getSearch,
  (state: SearchStateType) => state.messageLookup
);

export const getSearchResults = createSelector(
  [getSearch, getSearchConversationName, getConversationLookup],
  (
    state: SearchStateType,
    searchConversationName,
    conversationLookup: ConversationLookupType
  ): Pick<
    LeftPaneSearchPropsType,
    | 'conversationResults'
    | 'contactResults'
    | 'messageResults'
    | 'searchConversationName'
    | 'searchTerm'
  > => {
    const {
      contactIds,
      conversationIds,
      discussionsLoading,
      messageIds,
      messageLookup,
      messagesLoading,
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
          snippet: message.snippet || '',
          bodyRanges: bodyRanges.map((bodyRange: BodyRangeType) => {
            const conversation = conversationSelector(bodyRange.mentionUuid);

            return {
              ...bodyRange,
              replacementText: conversation.title,
            };
          }),
          body: message.body || '',

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

      const { conversationId, source, sourceUuid, type } = message;
      let from: ConversationType;
      let to: ConversationType;

      if (type === 'incoming') {
        from = conversationSelector(sourceUuid || source);
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
        selectedMessageId
      );
    };
  }
);
