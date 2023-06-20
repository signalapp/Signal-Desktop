import { compact } from 'lodash';
import { createSelector } from '@reduxjs/toolkit';

import { StateType } from '../reducer';

import { SearchStateType } from '../ducks/search';
import { getConversationLookup } from './conversations';
import { ConversationLookupType } from '../ducks/conversations';
import { getSelectedConversationKey } from './selectedConversation';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = (state: StateType): string => getSearch(state).query;

export const isSearching = (state: StateType) => {
  return !!getSearch(state)?.query?.trim();
};

export const getSearchResults = createSelector(
  [getSearch, getConversationLookup, getSelectedConversationKey],
  (searchState: SearchStateType, lookup: ConversationLookupType, selectedConversation?: string) => {
    return {
      contactsAndGroups: compact(
        searchState.contactsAndGroups.map(id => {
          const value = lookup[id];

          // on some edges cases, we have an id but no corresponding convo because it matches a query but the conversation was removed.
          if (!value) {
            return null;
          }

          // Don't return anything when activeAt is unset (i.e. no current conversations with this user)
          if (value.activeAt === undefined || value.activeAt === 0) {
            //activeAt can be 0 when linking device
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
      messages: compact(searchState.messages),
      searchTerm: searchState.query,
    };
  }
);
