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
        /*
        LOKI: Unsure what signal does with this
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
        */
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
      conversations: compact(
        state.conversations.map(id => {
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
      showStartNewConversation: Boolean(
        state.normalizedPhoneNumber && !lookup[state.normalizedPhoneNumber]
      ),
    };
  }
);
