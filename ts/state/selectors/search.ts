// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { createSelector } from 'reselect';
import { instance } from '../../util/libphonenumberInstance';

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

import {
  PropsDataType as SearchResultsPropsType,
  SearchResultRowType,
} from '../../components/SearchResults';
import { PropsDataType as MessageSearchResultPropsDataType } from '../../components/MessageSearchResult';

import { getRegionCode, getUserConversationId } from './user';
import { getUserAgent } from './items';
import {
  GetConversationByIdType,
  getConversationLookup,
  getConversationSelector,
  getSelectedConversation,
} from './conversations';

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
  getSearch,
  (state: SearchStateType) => {
    const { query } = state;

    return query && query.trim().length > 1;
  }
);

export const getMessageSearchResultLookup = createSelector(
  getSearch,
  (state: SearchStateType) => state.messageLookup
);
export const getSearchResults = createSelector(
  [
    getSearch,
    getRegionCode,
    getUserAgent,
    getConversationLookup,
    getSelectedConversation,
    getSelectedMessage,
  ],
  (
    state: SearchStateType,
    regionCode: string,
    userAgent: string,
    lookup: ConversationLookupType,
    selectedConversationId?: string,
    selectedMessageId?: string
  ): SearchResultsPropsType | undefined => {
    const {
      contacts,
      conversations,
      discussionsLoading,
      messageIds,
      messagesLoading,
      searchConversationName,
    } = state;

    const showStartNewConversation = Boolean(
      state.normalizedPhoneNumber && !lookup[state.normalizedPhoneNumber]
    );
    const haveConversations = conversations && conversations.length;
    const haveContacts = contacts && contacts.length;
    const haveMessages = messageIds && messageIds.length;
    const noResults =
      !discussionsLoading &&
      !messagesLoading &&
      !showStartNewConversation &&
      !haveConversations &&
      !haveContacts &&
      !haveMessages;

    const items: Array<SearchResultRowType> = [];

    if (showStartNewConversation) {
      items.push({
        type: 'start-new-conversation',
        data: undefined,
      });

      const isIOS = userAgent === 'OWI';
      let isValidNumber = false;
      try {
        // Sometimes parse() throws, like for invalid country codes
        const parsedNumber = instance.parse(state.query, regionCode);
        isValidNumber = instance.isValidNumber(parsedNumber);
      } catch (_) {
        // no-op
      }

      if (!isIOS && isValidNumber) {
        items.push({
          type: 'sms-mms-not-supported-text',
          data: undefined,
        });
      }
    }

    if (haveConversations) {
      items.push({
        type: 'conversations-header',
        data: undefined,
      });
      conversations.forEach(id => {
        const data = lookup[id];
        items.push({
          type: 'conversation',
          data: {
            ...data,
            isSelected: Boolean(data && id === selectedConversationId),
          },
        });
      });
    } else if (discussionsLoading) {
      items.push({
        type: 'conversations-header',
        data: undefined,
      });
      items.push({
        type: 'spinner',
        data: undefined,
      });
    }

    if (haveContacts) {
      items.push({
        type: 'contacts-header',
        data: undefined,
      });
      contacts.forEach(id => {
        const data = lookup[id];

        items.push({
          type: 'contact',
          data: {
            ...data,
            isSelected: Boolean(data && id === selectedConversationId),
          },
        });
      });
    }

    if (haveMessages) {
      items.push({
        type: 'messages-header',
        data: undefined,
      });
      messageIds.forEach(messageId => {
        items.push({
          type: 'message',
          data: messageId,
        });
      });
    } else if (messagesLoading) {
      items.push({
        type: 'messages-header',
        data: undefined,
      });
      items.push({
        type: 'spinner',
        data: undefined,
      });
    }

    return {
      discussionsLoading,
      items,
      messagesLoading,
      noResults,
      regionCode,
      searchConversationName,
      searchTerm: state.query,
      selectedConversationId,
      selectedMessageId,
    };
  }
);

export function _messageSearchResultSelector(
  message: MessageSearchResultType,
  from: ConversationType,
  to: ConversationType,
  searchConversationId?: string,
  selectedMessageId?: string
): MessageSearchResultPropsDataType {
  return {
    from,
    to,

    id: message.id,
    conversationId: message.conversationId,
    sentAt: message.sent_at,
    snippet: message.snippet,

    isSelected: Boolean(selectedMessageId && message.id === selectedMessageId),
    isSearchingInConversation: Boolean(searchConversationId),
  };
}

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
  (): CachedMessageSearchResultSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_messageSearchResultSelector, { max: 500 });
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
