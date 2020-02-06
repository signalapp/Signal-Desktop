import { compact } from 'lodash';
import { createSelector } from 'reselect';

import { StateType } from '../reducer';

import { SearchStateType } from '../ducks/search';
import {
  getConversationLookup,
  getSelectedConversation,
} from './conversations';
import { ConversationLookupType } from '../ducks/conversations';

import { getRegionCode } from './user';

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

export const getSearchResults = createSelector(
  [
    getSearch,
    getRegionCode,
    getConversationLookup,
    getSelectedConversation,
    getSelectedMessage,
  ],
  (
    state: SearchStateType,
    regionCode: string,
    lookup: ConversationLookupType,
    selectedConversation?: string,
    selectedMessage?: string
  ) => {
    return {
      contacts: compact(
        state.contacts.map(id => {
          const value = lookup[id];

          if (value && id === selectedConversation) {
            return {
              ...value,
              isSelected: true,
            };
          }

          return value;
        })
      ),
      conversations: compact(
        state.conversations.map(id => {
          const value = lookup[id];

          // Don't return anything when activeAt is undefined (i.e. no current conversations with this user)
          if (value.activeAt === undefined) {
            return null;
          }

          if (value && id === selectedConversation) {
            return {
              ...value,
              isSelected: true,
            };
          }

          return value;
        })
      ),
      friends: compact(
        state.conversations.map(id => {
          const value = lookup[id];
          const friend = value && value.isFriend ? { ...value } : null;

          if (friend && id === selectedConversation) {
            return {
              ...friend,
              isSelected: true,
            };
          }

          return friend;
        })
      ),
      hideMessagesHeader: false,
      messages: state.messages.map(message => {
        if (message.id === selectedMessage) {
          return {
            ...message,
            isSelected: true,
          };
        }

        return message;
      }),
      regionCode: regionCode,
      searchTerm: state.query,

      // We only want to show the start conversation if we don't have the query in our lookup
      showStartNewConversation: !lookup[state.query],
    };
  }
);
