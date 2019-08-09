import memoizee from 'memoizee';
import { createSelector } from 'reselect';
import { getSearchResultsProps } from '../../shims/Whisper';

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

import { getRegionCode, getUserNumber } from './user';
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
  [getSearch, getRegionCode, getConversationLookup, getSelectedConversation],
  (
    state: SearchStateType,
    regionCode: string,
    lookup: ConversationLookupType,
    selectedConversation?: string
  ): SearchResultsPropsType => {
    const { conversations, contacts, messageIds } = state;

    const showStartNewConversation = Boolean(
      state.normalizedPhoneNumber && !lookup[state.normalizedPhoneNumber]
    );
    const haveConversations = conversations && conversations.length;
    const haveContacts = contacts && contacts.length;
    const haveMessages = messageIds && messageIds.length;
    const noResults =
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
            isSelected: Boolean(data && id === selectedConversation),
          },
        });
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
            isSelected: Boolean(data && id === selectedConversation),
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
    }

    return {
      items,
      noResults,
      regionCode: regionCode,
      searchTerm: state.query,
    };
  }
);

export function _messageSearchResultSelector(
  message: MessageSearchResultType,
  // @ts-ignore
  ourNumber: string,
  // @ts-ignore
  regionCode: string,
  // @ts-ignore
  sender?: ConversationType,
  // @ts-ignore
  recipient?: ConversationType,
  selectedMessageId?: string
): MessageSearchResultPropsDataType {
  // Note: We don't use all of those parameters here, but the shim we call does.
  //   We want to call this function again if any of those parameters change.
  return {
    ...getSearchResultsProps(message),
    isSelected: message.id === selectedMessageId,
  };
}

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
type CachedMessageSearchResultSelectorType = (
  message: MessageSearchResultType,
  ourNumber: string,
  regionCode: string,
  sender?: ConversationType,
  recipient?: ConversationType,
  selectedMessageId?: string
) => MessageSearchResultPropsDataType;
export const getCachedSelectorForMessageSearchResult = createSelector(
  getRegionCode,
  getUserNumber,
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
  getRegionCode,
  getUserNumber,
  (
    messageSearchResultSelector: CachedMessageSearchResultSelectorType,
    messageSearchResultLookup: MessageSearchResultLookupType,
    selectedMessage: string | undefined,
    conversationSelector: GetConversationByIdType,
    regionCode: string,
    ourNumber: string
  ): GetMessageSearchResultByIdType => {
    return (id: string) => {
      const message = messageSearchResultLookup[id];
      if (!message) {
        return;
      }

      const { conversationId, source, type } = message;
      let sender: ConversationType | undefined;
      let recipient: ConversationType | undefined;

      if (type === 'incoming') {
        sender = conversationSelector(source);
        recipient = conversationSelector(ourNumber);
      } else if (type === 'outgoing') {
        sender = conversationSelector(ourNumber);
        recipient = conversationSelector(conversationId);
      }

      return messageSearchResultSelector(
        message,
        ourNumber,
        regionCode,
        sender,
        recipient,
        selectedMessage
      );
    };
  }
);
