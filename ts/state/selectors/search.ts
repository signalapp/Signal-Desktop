import { compact } from 'lodash';
import { createSelector } from 'reselect';

import { StateType } from '../reducer';

import { SearchStateType } from '../ducks/search';
import {
  getConversationLookup,
  getSelectedConversation,
  getSelectedConversationKey,
} from './conversations';
import { ConversationLookupType } from '../ducks/conversations';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = createSelector(getSearch, (state: SearchStateType): string => state.query);

export const getSelectedMessage = createSelector(
  getSearch,
  (state: SearchStateType): string | undefined => state.selectedMessage
);

export const isSearching = createSelector(getSearch, (state: SearchStateType) => {
  const { query } = state;

  return Boolean(query && query.trim().length > 1);
});

export const getSearchResults = createSelector(
  [getSearch, getConversationLookup, getSelectedConversationKey, getSelectedMessage],
  (
    state: SearchStateType,
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
      searchTerm: state.query,
    };
  }
);
