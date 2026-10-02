// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { createSelector } from 'reselect';

import { deconstructLookup } from '../../util/deconstructLookup.std.ts';

import type { StateType } from '../reducer.preload.ts';

import type {
  MessageSearchResultLookupType,
  MessageSearchResultType,
  SearchStateType,
} from '../ducks/search.preload.ts';
import type {
  ConversationLookupType,
  ConversationType,
} from '../ducks/conversations.preload.ts';

import type { LeftPaneSearchPropsType } from '../../components/leftPane/LeftPaneSearchHelper.dom.tsx';
import type { PropsDataType as MessageSearchResultPropsDataType } from '../../components/conversationList/MessageSearchResult.dom.tsx';

import { getIntl, getUserConversationId, getRegionCode } from './user.std.ts';
import type { GetConversationByIdType } from './conversations.dom.ts';
import {
  getConversationLookup,
  getConversationSelector,
  getAllConversations,
} from './conversations.dom.ts';
import {
  getSelectedChatFolder,
  getStableSelectedConversationIdInChatFolder,
} from './chatFolders.std.ts';

import { hydrateRanges } from '../../util/BodyRange.node.ts';
import type { RawBodyRange } from '../../types/BodyRange.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { getOwn } from '../../util/getOwn.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { getSelectedConversationId } from './nav.std.ts';
import { isConversationInChatFolder } from '../../types/ChatFolder.std.ts';
import type { CurrentChatFolder } from '../../types/CurrentChatFolders.std.ts';
import { isConversationUnread } from '../../util/countUnreadStats.std.ts';
import { filterAndSortConversations } from '../../util/filterAndSortConversations.std.ts';

const log = createLogger('search');

const getSearch = (state: StateType): SearchStateType => state.search;

export const getFilterByUnread = createSelector(
  getSearch,
  (state: SearchStateType): boolean => state.filterByUnread
);

export const getQuery = createSelector(
  getSearch,
  (state: SearchStateType): string => state.query
);

const getSelectedMessage = createSelector(
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

const getSearchConversationName = createSelector(
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

const getMessageSearchResultLookup = createSelector(
  getSearch,
  (state: SearchStateType) => state.messageLookup
);

function isUnreadAndInChatFolder(
  conversation: ConversationType,
  selectedChatFolder: CurrentChatFolder | null,
  stableSelectedConversationIdInChatFolder: string | null
): boolean {
  if (stableSelectedConversationIdInChatFolder === conversation.id) {
    return true;
  }
  if (
    selectedChatFolder != null &&
    !isConversationInChatFolder(selectedChatFolder, conversation)
  ) {
    return false;
  }
  return isConversationUnread(conversation, {
    activeProfile: undefined,
    includeMuted: 'force-include',
  });
}

export const getSearchResults = createSelector(
  [
    getSearch,
    getSearchConversationName,
    getConversationLookup,
    getSelectedConversationId,
    getAllConversations,
    getSelectedChatFolder,
    getStableSelectedConversationIdInChatFolder,
    getRegionCode,
  ],
  (
    state: SearchStateType,
    searchConversationName,
    conversationLookup: ConversationLookupType,
    selectedConversationId: string | undefined,
    allConversations: Array<ConversationType>,
    selectedChatFolder: CurrentChatFolder | null,
    stableSelectedConversationIdInChatFolder: string | null,
    regionCode: string | undefined
  ): Pick<
    LeftPaneSearchPropsType,
    | 'conversationResults'
    | 'contactResults'
    | 'messageResults'
    | 'searchConversationName'
    | 'searchTerm'
    | 'filterByUnread'
  > => {
    const hasSearchQuery = state.query.trim().length > 0;

    if (state.filterByUnread && !hasSearchQuery) {
      const filtered = allConversations.filter(conversation =>
        isUnreadAndInChatFolder(
          conversation,
          selectedChatFolder,
          stableSelectedConversationIdInChatFolder
        )
      );
      const sorted = filterAndSortConversations(
        filtered,
        '',
        regionCode,
        false
      );

      return {
        conversationResults: {
          isLoading: false,
          results: sorted.map(conversation => ({
            ...conversation,
            isSelected: selectedConversationId === conversation.id,
          })),
        },
        contactResults: { isLoading: false, results: [] },
        messageResults: { isLoading: false, results: [] },
        searchConversationName,
        searchTerm: state.query,
        filterByUnread: true,
      };
    }

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

    if (state.filterByUnread && !searchResults.conversationResults.isLoading) {
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

/** Must be kept in sync with messages.searchableText virtual column  */
function getSearchableTextAndBodyRanges(message: MessageAttributesType): {
  text: string | undefined;
  bodyRanges: ReadonlyArray<RawBodyRange> | undefined;
} {
  if (message.poll) {
    return {
      text: message.poll.question,
      bodyRanges: undefined,
    };
  }

  return {
    text: message.body,
    bodyRanges: message.bodyRanges,
  };
}
const getCachedSelectorForMessageSearchResult = createSelector(
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
        const { text, bodyRanges } = getSearchableTextAndBodyRanges(message);
        return {
          from,
          to,

          id: message.id,
          conversationId: message.conversationId,
          sentAt: message.sent_at,
          snippet: message.snippet || '',
          bodyRanges: hydrateRanges(bodyRanges, conversationSelector) || [],
          body: text ?? '',

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
