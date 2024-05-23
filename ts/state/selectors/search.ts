import { createSelector } from '@reduxjs/toolkit';
import { compact, isEmpty, sortBy } from 'lodash';

import { StateType } from '../reducer';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';
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
      contactsAndConversations: compact(
        searchState.contactsAndConversations
          .filter(id => {
            const value = lookup[id];

            // on some edges cases, we have an id but no corresponding convo because it matches a query but the conversation was removed.
            // Don't return anything when activeAt is unset (i.e. no current conversations with this user)
            if (!value || value.activeAt === undefined || value.activeAt === 0) {
              // activeAt can be 0 when linking device
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

export const getSearchTerm = createSelector([getSearchResults], searchResult => {
  return searchResult.searchTerm;
});

export const getSearchResultsIdsOnly = createSelector([getSearchResults], searchState => {
  return {
    ...searchState,
    contactsAndConversationIds: searchState.contactsAndConversations.map(m => m.id),
  };
});

export const getHasSearchResults = createSelector([getSearchResults], searchState => {
  return !isEmpty(searchState.contactsAndConversations) || !isEmpty(searchState.messages);
});

export const getSearchResultsContactOnly = createSelector([getSearchResults], searchState => {
  return searchState.contactsAndConversations.filter(m => m.isPrivate).map(m => m.id);
});

/**
 *
 * When type is string, we render a sectionHeader.
 * When type just has a conversationId field, we render a ConversationListItem.
 * When type is MessageResultProps we render a MessageSearchResult
 */
export type SearchResultsMergedListItem =
  | string
  | { contactConvoId: string; displayName?: string }
  | MessageResultProps;

export const getSearchResultsList = createSelector([getSearchResults], searchState => {
  const { contactsAndConversations, messages } = searchState;
  window.log.debug(
    `WIP: [getSearchResultsList] contactsAndConversations ${JSON.stringify(contactsAndConversations)}`
  );
  const builtList: Array<SearchResultsMergedListItem> = [];

  if (contactsAndConversations.length) {
    const us = UserUtils.getOurPubKeyStrFromCache();
    let usIndex: number = -1;

    const idsAndDisplayNames = contactsAndConversations.map(m => ({
      contactConvoId: m.id,
      displayName: m.nickname || m.displayNameInProfile,
    }));

    const idsWithDisplayNames = sortBy(
      idsAndDisplayNames.filter(m => Boolean(m.displayName)),
      m => m.displayName?.toLowerCase()
    );
    if (idsWithDisplayNames.length) {
      // add a break wherever needed
      let currentChar = '';
      for (let i = 0; i < idsWithDisplayNames.length; i++) {
        const m = idsWithDisplayNames[i];
        if (m.contactConvoId === us) {
          usIndex = i;
          continue;
        }
        if (
          idsWithDisplayNames.length > 1 &&
          m.displayName &&
          m.displayName[0].toLowerCase() !== currentChar
        ) {
          currentChar = m.displayName[0].toLowerCase();
          builtList.push(currentChar.toUpperCase());
        }
        builtList.push(m);
      }

      if (usIndex !== -1) {
        builtList.unshift({ contactConvoId: us, displayName: window.i18n('noteToSelf') });
      }
    }

    const idsWithNoDisplayNames = sortBy(
      idsAndDisplayNames.filter(m => !m.displayName),
      'id'
    );
    if (idsWithNoDisplayNames.length) {
      builtList.push(window.i18n('unknown'), ...idsWithNoDisplayNames);
    }

    builtList.unshift(window.i18n('sessionConversations'));
  }

  if (messages.length) {
    builtList.push(window.i18n('messages'));
    builtList.push(...messages);
  }

  return builtList;
});
