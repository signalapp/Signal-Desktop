import { createSelector } from '@reduxjs/toolkit';
import { compact } from 'lodash';

import { StateType } from '../reducer';

import { ConversationLookupType } from '../ducks/conversations';
import { SearchStateType } from '../ducks/search';
import { getConversationLookup } from './conversations';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = (state: StateType): string => getSearch(state).query;

export const isSearching = (state: StateType) => {
  return !!getSearch(state)?.query?.trim();
};

const getSearchResults = createSelector(
  [getSearch, getConversationLookup],
  (searchState: SearchStateType, lookup: ConversationLookupType) => {
    return {
      contactsAndGroups: compact(
        searchState.contactsAndGroups
          .filter(id => {
            const value = lookup[id];

            // on some edges cases, we have an id but no corresponding convo because it matches a query but the conversation was removed.
            // Don't return anything when activeAt is unset (i.e. no current conversations with this user)
            if (!value || value.activeAt === undefined || value.activeAt === 0) {
              //activeAt can be 0 when linking device
              return false;
            }

            return true;
          })
          .map(id => lookup[id])
      ),
      messages: compact(searchState.messages),
      searchTerm: searchState.query,
    };
  }
);

export const getSearchResultsIdsOnly = createSelector([getSearchResults], searchState => {
  return {
    ...searchState,
    contactsAndGroupsIds: searchState.contactsAndGroups.map(m => m.id),
  };
});

export const getSearchResultsContactOnly = createSelector([getSearchResults], searchState => {
  return searchState.contactsAndGroups.filter(m => m.isPrivate).map(m => m.id);
});
