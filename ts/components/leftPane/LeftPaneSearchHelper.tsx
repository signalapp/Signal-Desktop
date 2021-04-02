// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild } from 'react';

import { LeftPaneHelper, ToFindType } from './LeftPaneHelper';
import { LocalizerType } from '../../types/Util';
import { Row, RowType } from '../ConversationList';
import { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';

import { Intl } from '../Intl';
import { Emojify } from '../conversation/Emojify';
import { assert } from '../../util/assert';

// The "correct" thing to do is to measure the size of the left pane and render enough
//   search results for the container height. But (1) that's slow (2) the list is
//   virtualized (3) 99 rows is over 6000px tall, taller than most monitors (4) it's fine
//   if, in some extremely tall window, we have some empty space. So we just hard-code a
//   fairly big number.
const SEARCH_RESULTS_FAKE_ROW_COUNT = 99;

type MaybeLoadedSearchResultsType<T> =
  | { isLoading: true }
  | { isLoading: false; results: Array<T> };

export type LeftPaneSearchPropsType = {
  conversationResults: MaybeLoadedSearchResultsType<
    ConversationListItemPropsType
  >;
  contactResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  messageResults: MaybeLoadedSearchResultsType<{
    id: string;
    conversationId: string;
  }>;
  searchConversationName?: string;
  searchTerm: string;
};

const searchResultKeys: Array<
  'conversationResults' | 'contactResults' | 'messageResults'
> = ['conversationResults', 'contactResults', 'messageResults'];

export class LeftPaneSearchHelper extends LeftPaneHelper<
  LeftPaneSearchPropsType
> {
  private readonly conversationResults: MaybeLoadedSearchResultsType<
    ConversationListItemPropsType
  >;

  private readonly contactResults: MaybeLoadedSearchResultsType<
    ConversationListItemPropsType
  >;

  private readonly messageResults: MaybeLoadedSearchResultsType<{
    id: string;
    conversationId: string;
  }>;

  private readonly searchConversationName?: string;

  private readonly searchTerm: string;

  constructor({
    conversationResults,
    contactResults,
    messageResults,
    searchConversationName,
    searchTerm,
  }: Readonly<LeftPaneSearchPropsType>) {
    super();

    this.conversationResults = conversationResults;
    this.contactResults = contactResults;
    this.messageResults = messageResults;
    this.searchConversationName = searchConversationName;
    this.searchTerm = searchTerm;
  }

  getPreRowsNode({
    i18n,
  }: Readonly<{ i18n: LocalizerType }>): null | ReactChild {
    const mightHaveSearchResults = this.allResults().some(
      searchResult => searchResult.isLoading || searchResult.results.length
    );
    if (mightHaveSearchResults) {
      return null;
    }

    const { searchConversationName, searchTerm } = this;

    return !searchConversationName || searchTerm ? (
      <div
        // We need this for Ctrl-T shortcut cycling through parts of app
        tabIndex={-1}
        className="module-left-pane__no-search-results"
        key={searchTerm}
      >
        {searchConversationName ? (
          <Intl
            id="noSearchResultsInConversation"
            i18n={i18n}
            components={{
              searchTerm,
              conversationName: (
                <Emojify key="item-1" text={searchConversationName} />
              ),
            }}
          />
        ) : (
          i18n('noSearchResults', [searchTerm])
        )}
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
  // eslint-disable-next-line class-methods-use-this
  getRowIndexToScrollTo(
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

    const conversationRowCount = getRowCountForLoadedSearchResults(
      conversationResults
    );
    const contactRowCount = getRowCountForLoadedSearchResults(contactResults);
    const messageRowCount = getRowCountForLoadedSearchResults(messageResults);

    if (rowIndex < conversationRowCount) {
      if (rowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'conversationsHeader',
        };
      }
      assert(
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
          i18nKey: 'contactsHeader',
        };
      }
      assert(
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
        i18nKey: 'messagesHeader',
      };
    }
    assert(
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

  isScrollable(): boolean {
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

  // This is currently unimplemented. See DESKTOP-1170.
  // eslint-disable-next-line class-methods-use-this
  getConversationAndMessageAtIndex(
    _conversationIndex: number
  ): undefined | { conversationId: string; messageId?: string } {
    return undefined;
  }

  // This is currently unimplemented. See DESKTOP-1170.
  // eslint-disable-next-line class-methods-use-this
  getConversationAndMessageInDirection(
    _toFind: Readonly<ToFindType>,
    _selectedConversationId: undefined | string,
    _selectedMessageId: unknown
  ): undefined | { conversationId: string } {
    return undefined;
  }

  private allResults() {
    return [this.conversationResults, this.contactResults, this.messageResults];
  }

  private isLoading(): boolean {
    return this.allResults().some(results => results.isLoading);
  }
}

function getRowCountForLoadedSearchResults(
  searchResults: Readonly<MaybeLoadedSearchResultsType<unknown>>
): number {
  // It's possible to call this helper with invalid results (e.g., ones that are loading).
  //   We could change the parameter of this function, but that adds a bunch of redundant
  //   checks that are, in the author's opinion, less clear.
  if (searchResults.isLoading) {
    assert(
      false,
      'getRowCountForLoadedSearchResults: Expected this to be called with loaded search results. Returning 0'
    );
    return 0;
  }

  const resultRows = searchResults.results.length;
  const hasHeader = Boolean(resultRows);
  return (hasHeader ? 1 : 0) + resultRows;
}
