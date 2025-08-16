// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';

import type { ToFindType } from './LeftPaneHelper';
import { LeftPaneHelper } from './LeftPaneHelper';
import type { LocalizerType } from '../../types/Util';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import { handleKeydownForSearch } from './handleKeydownForSearch';
import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations';
import { LeftPaneSearchInput } from '../LeftPaneSearchInput';

import { I18n } from '../I18n';
import { assertDev } from '../../util/assert';
import { UserText } from '../UserText';

// The "correct" thing to do is to measure the size of the left pane and render enough
//   search results for the container height. But (1) that's slow (2) the list is
//   virtualized (3) 99 rows is over 7500px tall, taller than most monitors (4) it's fine
//   if, in some extremely tall window, we have some empty space. So we just hard-code a
//   fairly big number.
const SEARCH_RESULTS_FAKE_ROW_COUNT = 99;

type MaybeLoadedSearchResultsType<T> =
  | { isLoading: true }
  | { isLoading: false; results: Array<T> };

export type LeftPaneSearchPropsType = {
  conversationResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  contactResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  messageResults: MaybeLoadedSearchResultsType<{
    id: string;
    conversationId: string;
    type: string;
  }>;
  searchConversationName?: string;
  searchTerm: string;
  filterByUnread: boolean;
  startSearchCounter: number;
  isSearchingGlobally: boolean;
  searchDisabled: boolean;
  searchConversation: undefined | ConversationType;
};

export class LeftPaneSearchHelper extends LeftPaneHelper<LeftPaneSearchPropsType> {
  readonly #conversationResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  readonly #contactResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  readonly #isSearchingGlobally: boolean;

  readonly #messageResults: MaybeLoadedSearchResultsType<{
    id: string;
    conversationId: string;
    type: string;
  }>;

  readonly #searchConversationName?: string;
  readonly #searchTerm: string;
  readonly #startSearchCounter: number;
  readonly #searchDisabled: boolean;
  readonly #searchConversation: undefined | ConversationType;
  readonly #filterByUnread: boolean;

  constructor({
    contactResults,
    conversationResults,
    isSearchingGlobally,
    messageResults,
    searchConversation,
    searchConversationName,
    searchDisabled,
    searchTerm,
    startSearchCounter,
    filterByUnread,
  }: Readonly<LeftPaneSearchPropsType>) {
    super();

    this.#contactResults = contactResults;
    this.#conversationResults = conversationResults;
    this.#isSearchingGlobally = isSearchingGlobally;
    this.#messageResults = messageResults;
    this.#searchConversation = searchConversation;
    this.#searchConversationName = searchConversationName;
    this.#searchDisabled = searchDisabled;
    this.#searchTerm = searchTerm;
    this.#startSearchCounter = startSearchCounter;
    this.#filterByUnread = filterByUnread;
  }

  override getSearchInput({
    clearConversationSearch,
    clearSearchQuery,
    endConversationSearch,
    endSearch,
    i18n,
    showConversation,
    updateSearchTerm,
    updateFilterByUnread,
  }: Readonly<{
    clearConversationSearch: () => unknown;
    clearSearchQuery: () => unknown;
    endConversationSearch: () => unknown;
    endSearch: () => unknown;
    i18n: LocalizerType;
    showConversation: ShowConversationType;
    updateSearchTerm: (searchTerm: string) => unknown;
    updateFilterByUnread: (filterByUnread: boolean) => void;
  }>): ReactChild {
    return (
      <LeftPaneSearchInput
        clearConversationSearch={clearConversationSearch}
        clearSearchQuery={clearSearchQuery}
        endConversationSearch={endConversationSearch}
        endSearch={endSearch}
        disabled={this.#searchDisabled}
        i18n={i18n}
        isSearchingGlobally={this.#isSearchingGlobally}
        onEnterKeyDown={this.#onEnterKeyDown}
        searchConversation={this.#searchConversation}
        searchTerm={this.#searchTerm}
        showConversation={showConversation}
        startSearchCounter={this.#startSearchCounter}
        updateSearchTerm={updateSearchTerm}
        filterButtonEnabled={!this.#searchConversation}
        filterPressed={this.#filterByUnread}
        onFilterClick={updateFilterByUnread}
      />
    );
  }

  override getPreRowsNode({
    i18n,
  }: Readonly<{
    i18n: LocalizerType;
  }>): ReactChild | null {
    const mightHaveSearchResults = this.#allResults().some(
      searchResult => searchResult.isLoading || searchResult.results.length
    );

    if (mightHaveSearchResults) {
      return null;
    }

    const searchTerm = this.#searchTerm;
    const searchConversationName = this.#searchConversationName;

    let noResults: ReactChild;
    if (searchConversationName) {
      noResults = (
        <I18n
          id="icu:noSearchResultsInConversation"
          i18n={i18n}
          components={{
            searchTerm,
            conversationName: (
              <UserText key="item-1" text={searchConversationName} />
            ),
          }}
        />
      );
    } else {
      let noResultsMessage: string;
      if (this.#filterByUnread && this.#searchTerm.length > 0) {
        noResultsMessage = i18n('icu:noSearchResultsWithUnreadFilter', {
          searchTerm,
        });
      } else if (this.#filterByUnread) {
        noResultsMessage = i18n('icu:noSearchResultsOnlyUnreadFilter');
      } else {
        noResultsMessage = i18n('icu:noSearchResults', {
          searchTerm,
        });
      }
      noResults = (
        <>
          {this.#filterByUnread && (
            <div
              className="module-conversation-list__item--header module-left-pane__no-search-results__unread-header"
              aria-label={i18n('icu:conversationsUnreadHeader')}
            >
              {i18n('icu:conversationsUnreadHeader')}
            </div>
          )}
          <div>{noResultsMessage}</div>
        </>
      );
    }

    return !searchConversationName || searchTerm ? (
      <div
        // We need this for Ctrl-T shortcut cycling through parts of app
        tabIndex={-1}
        className={
          this.#filterByUnread
            ? 'module-left-pane__no-search-results--withHeader'
            : 'module-left-pane__no-search-results'
        }
        key={searchTerm}
      >
        {noResults}
      </div>
    ) : null;
  }

  getRowCount(): number {
    if (this.#isLoading()) {
      // 1 for the header.
      return 1 + SEARCH_RESULTS_FAKE_ROW_COUNT;
    }

    let count = this.#allResults().reduce(
      (result: number, searchResults) =>
        result + getRowCountForLoadedSearchResults(searchResults),
      0
    );

    // The clear unread filter button adds an extra row
    if (this.#filterByUnread) {
      count += 1;
    }

    return count;
  }

  // This is currently unimplemented. See DESKTOP-1170.
  override getRowIndexToScrollTo(
    _selectedConversationId: undefined | string
  ): undefined | number {
    return undefined;
  }

  getRow(rowIndex: number): undefined | Row {
    const messageResults = this.#messageResults;
    const contactResults = this.#contactResults;
    const conversationResults = this.#conversationResults;

    if (this.#isLoading()) {
      if (rowIndex === 0) {
        return { type: RowType.SearchResultsLoadingFakeHeader };
      }
      if (rowIndex + 1 <= SEARCH_RESULTS_FAKE_ROW_COUNT) {
        return { type: RowType.SearchResultsLoadingFakeRow };
      }
      return undefined;
    }

    const conversationRowCount =
      getRowCountForLoadedSearchResults(conversationResults);
    const contactRowCount = getRowCountForLoadedSearchResults(contactResults);
    const messageRowCount = getRowCountForLoadedSearchResults(messageResults);
    const clearFilterButtonRowCount = this.#filterByUnread ? 1 : 0;

    let rowOffset = 0;

    rowOffset += conversationRowCount;
    if (rowIndex < rowOffset) {
      if (rowIndex === 0) {
        return {
          type: RowType.Header,
          getHeaderText: i18n =>
            this.#filterByUnread
              ? i18n('icu:conversationsUnreadHeader')
              : i18n('icu:conversationsHeader'),
        };
      }
      assertDev(
        !conversationResults.isLoading,
        "We shouldn't get here with conversation results still loading"
      );
      const conversation = conversationResults.results[rowIndex - 1];
      return conversation
        ? {
            type: RowType.Conversation,
            conversation,
          }
        : undefined;
    }

    rowOffset += contactRowCount;

    if (rowIndex < rowOffset) {
      const localIndex = rowIndex - conversationRowCount;
      if (localIndex === 0) {
        return {
          type: RowType.Header,
          getHeaderText: i18n => i18n('icu:contactsHeader'),
        };
      }
      assertDev(
        !contactResults.isLoading,
        "We shouldn't get here with contact results still loading"
      );
      const conversation = contactResults.results[localIndex - 1];
      return conversation
        ? {
            type: RowType.Conversation,
            conversation,
          }
        : undefined;
    }

    rowOffset += messageRowCount;
    if (rowIndex < rowOffset) {
      const localIndex = rowIndex - conversationRowCount - contactRowCount;
      if (localIndex === 0) {
        return {
          type: RowType.Header,
          getHeaderText: i18n => i18n('icu:messagesHeader'),
        };
      }
      assertDev(
        !messageResults.isLoading,
        "We shouldn't get here with message results still loading"
      );
      const message = messageResults.results[localIndex - 1];
      return message
        ? {
            type: RowType.MessageSearchResult,
            messageId: message.id,
          }
        : undefined;
    }

    rowOffset += clearFilterButtonRowCount;
    if (rowIndex < rowOffset) {
      return {
        type: RowType.ClearFilterButton,
        isOnNoResultsPage: this.#allResults().every(
          searchResult =>
            searchResult.isLoading || searchResult.results.length === 0
        ),
      };
    }

    return undefined;
  }

  override isScrollable(): boolean {
    return !this.#isLoading();
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneSearchPropsType>): boolean {
    const oldSearchPaneHelper = new LeftPaneSearchHelper(old);
    const oldIsLoading = oldSearchPaneHelper.#isLoading();
    const newIsLoading = this.#isLoading();
    if (oldIsLoading && newIsLoading) {
      return false;
    }
    if (oldIsLoading !== newIsLoading) {
      return true;
    }
    const searchResultsByKey = [
      { current: this.#conversationResults, prev: old.conversationResults },
      { current: this.#contactResults, prev: old.contactResults },
      { current: this.#messageResults, prev: old.messageResults },
    ];
    return searchResultsByKey.some(item => {
      return (
        getRowCountForLoadedSearchResults(item.prev) !==
        getRowCountForLoadedSearchResults(item.current)
      );
    });
  }

  getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string; messageId?: string } {
    if (conversationIndex < 0) {
      return undefined;
    }
    let pointer = conversationIndex;
    for (const list of this.#allResults()) {
      if (list.isLoading) {
        continue;
      }
      if (pointer < list.results.length) {
        const result = list.results[pointer];
        return result.type === 'incoming' || result.type === 'outgoing' // message
          ? {
              conversationId: result.conversationId,
              messageId: result.id,
            }
          : { conversationId: result.id };
      }
      pointer -= list.results.length;
    }
    return undefined;
  }

  // This is currently unimplemented. See DESKTOP-1170.
  getConversationAndMessageInDirection(
    _toFind: Readonly<ToFindType>,
    _selectedConversationId: undefined | string,
    _targetedMessageId: unknown
  ): undefined | { conversationId: string } {
    return undefined;
  }

  override onKeyDown(
    event: KeyboardEvent,
    options: Readonly<{
      searchInConversation: (conversationId: string) => unknown;
      selectedConversationId: undefined | string;
      startSearch: () => unknown;
    }>
  ): void {
    handleKeydownForSearch(event, options);
  }

  #allResults() {
    return [
      this.#conversationResults,
      this.#contactResults,
      this.#messageResults,
    ];
  }

  #isLoading(): boolean {
    return this.#allResults().some(results => results.isLoading);
  }

  #onEnterKeyDown = (
    clearSearchQuery: () => unknown,
    showConversation: ShowConversationType
  ): void => {
    const conversation = this.getConversationAndMessageAtIndex(0);
    if (!conversation) {
      return;
    }
    showConversation(conversation);
    clearSearchQuery();
  };
}

function getRowCountForLoadedSearchResults(
  searchResults: Readonly<MaybeLoadedSearchResultsType<unknown>>
): number {
  // It's possible to call this helper with invalid results (e.g., ones that are loading).
  //   We could change the parameter of this function, but that adds a bunch of redundant
  //   checks that are, in the author's opinion, less clear.
  if (searchResults.isLoading) {
    assertDev(
      false,
      'getRowCountForLoadedSearchResults: Expected this to be called with loaded search results. Returning 0'
    );
    return 0;
  }

  const resultRows = searchResults.results.length;
  const hasHeader = Boolean(resultRows);
  return (hasHeader ? 1 : 0) + resultRows;
}
