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
  primarySendsSms: boolean;
  searchTerm: string;
  startSearchCounter: number;
  searchDisabled: boolean;
  searchConversation: undefined | ConversationType;
};

const searchResultKeys: Array<
  'conversationResults' | 'contactResults' | 'messageResults'
> = ['conversationResults', 'contactResults', 'messageResults'];

export class LeftPaneSearchHelper extends LeftPaneHelper<LeftPaneSearchPropsType> {
  private readonly conversationResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;

  private readonly contactResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;

  private readonly messageResults: MaybeLoadedSearchResultsType<{
    id: string;
    conversationId: string;
    type: string;
  }>;

  private readonly searchConversationName?: string;

  private readonly primarySendsSms: boolean;

  private readonly searchTerm: string;

  private readonly startSearchCounter: number;

  private readonly searchDisabled: boolean;

  private readonly searchConversation: undefined | ConversationType;

  constructor({
    contactResults,
    conversationResults,
    messageResults,
    primarySendsSms,
    searchConversation,
    searchConversationName,
    searchDisabled,
    searchTerm,
    startSearchCounter,
  }: Readonly<LeftPaneSearchPropsType>) {
    super();

    this.contactResults = contactResults;
    this.conversationResults = conversationResults;
    this.messageResults = messageResults;
    this.primarySendsSms = primarySendsSms;
    this.searchConversation = searchConversation;
    this.searchConversationName = searchConversationName;
    this.searchDisabled = searchDisabled;
    this.searchTerm = searchTerm;
    this.startSearchCounter = startSearchCounter;
    this.onEnterKeyDown = this.onEnterKeyDown.bind(this);
  }

  override getSearchInput({
    clearConversationSearch,
    clearSearch,
    i18n,
    showConversation,
    updateSearchTerm,
  }: Readonly<{
    clearConversationSearch: () => unknown;
    clearSearch: () => unknown;
    i18n: LocalizerType;
    showConversation: ShowConversationType;
    updateSearchTerm: (searchTerm: string) => unknown;
  }>): ReactChild {
    return (
      <LeftPaneSearchInput
        clearConversationSearch={clearConversationSearch}
        clearSearch={clearSearch}
        disabled={this.searchDisabled}
        i18n={i18n}
        onEnterKeyDown={this.onEnterKeyDown}
        searchConversation={this.searchConversation}
        searchTerm={this.searchTerm}
        showConversation={showConversation}
        startSearchCounter={this.startSearchCounter}
        updateSearchTerm={updateSearchTerm}
      />
    );
  }

  override getPreRowsNode({
    i18n,
  }: Readonly<{
    i18n: LocalizerType;
  }>): ReactChild | null {
    const mightHaveSearchResults = this.allResults().some(
      searchResult => searchResult.isLoading || searchResult.results.length
    );

    if (mightHaveSearchResults) {
      return null;
    }

    const { searchConversationName, primarySendsSms, searchTerm } = this;

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
      noResults = (
        <>
          <div>
            {i18n('icu:noSearchResults', {
              searchTerm,
            })}
          </div>
          {primarySendsSms && (
            <div className="module-left-pane__no-search-results__sms-only">
              {i18n('icu:noSearchResults--sms-only')}
            </div>
          )}
        </>
      );
    }

    return !searchConversationName || searchTerm ? (
      <div
        // We need this for Ctrl-T shortcut cycling through parts of app
        tabIndex={-1}
        className="module-left-pane__no-search-results"
        key={searchTerm}
      >
        {noResults}
      </div>
    ) : null;
  }

  getRowCount(): number {
    if (this.isLoading()) {
      // 1 for the header.
      return 1 + SEARCH_RESULTS_FAKE_ROW_COUNT;
    }

    return this.allResults().reduce(
      (result: number, searchResults) =>
        result + getRowCountForLoadedSearchResults(searchResults),
      0
    );
  }

  // This is currently unimplemented. See DESKTOP-1170.
  override getRowIndexToScrollTo(
    _selectedConversationId: undefined | string
  ): undefined | number {
    return undefined;
  }

  getRow(rowIndex: number): undefined | Row {
    const { conversationResults, contactResults, messageResults } = this;

    if (this.isLoading()) {
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

    if (rowIndex < conversationRowCount) {
      if (rowIndex === 0) {
        return {
          type: RowType.Header,
          getHeaderText: i18n => i18n('icu:conversationsHeader'),
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

    if (rowIndex < conversationRowCount + contactRowCount) {
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

    if (rowIndex >= conversationRowCount + contactRowCount + messageRowCount) {
      return undefined;
    }

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

  override isScrollable(): boolean {
    return !this.isLoading();
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneSearchPropsType>): boolean {
    const oldIsLoading = new LeftPaneSearchHelper(old).isLoading();
    const newIsLoading = this.isLoading();
    if (oldIsLoading && newIsLoading) {
      return false;
    }
    if (oldIsLoading !== newIsLoading) {
      return true;
    }
    return searchResultKeys.some(
      key =>
        getRowCountForLoadedSearchResults(old[key]) !==
        getRowCountForLoadedSearchResults(this[key])
    );
  }

  getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string; messageId?: string } {
    if (conversationIndex < 0) {
      return undefined;
    }
    let pointer = conversationIndex;
    for (const list of this.allResults()) {
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

  private allResults() {
    return [this.conversationResults, this.contactResults, this.messageResults];
  }

  private isLoading(): boolean {
    return this.allResults().some(results => results.isLoading);
  }

  private onEnterKeyDown(
    clearSearch: () => unknown,
    showConversation: ShowConversationType
  ): void {
    const conversation = this.getConversationAndMessageAtIndex(0);
    if (!conversation) {
      return;
    }
    showConversation(conversation);
    clearSearch();
  }
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
