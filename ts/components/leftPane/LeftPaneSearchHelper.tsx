// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild } from 'react';

import { LeftPaneHelper, ToFindType } from './LeftPaneHelper';
import { LocalizerType } from '../../types/Util';
import { Row, RowType } from '../ConversationList';
import { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';

import { Intl } from '../Intl';
import { Emojify } from '../conversation/Emojify';

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
    return this.allResults().reduce(
      (result: number, searchResults) =>
        result + getRowCountForSearchResult(searchResults),
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

    const conversationRowCount = getRowCountForSearchResult(
      conversationResults
    );
    const contactRowCount = getRowCountForSearchResult(contactResults);
    const messageRowCount = getRowCountForSearchResult(messageResults);

    if (rowIndex < conversationRowCount) {
      if (rowIndex === 0) {
        return {
          type: RowType.Header,
          i18nKey: 'conversationsHeader',
        };
      }
      if (conversationResults.isLoading) {
        return { type: RowType.Spinner };
      }
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
      if (contactResults.isLoading) {
        return { type: RowType.Spinner };
      }
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
    if (messageResults.isLoading) {
      return { type: RowType.Spinner };
    }
    const message = messageResults.results[localIndex - 1];
    return message
      ? {
          type: RowType.MessageSearchResult,
          messageId: message.id,
        }
      : undefined;
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneSearchPropsType>): boolean {
    return searchResultKeys.some(
      key =>
        getRowCountForSearchResult(old[key]) !==
        getRowCountForSearchResult(this[key])
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
}

function getRowCountForSearchResult(
  searchResults: Readonly<MaybeLoadedSearchResultsType<unknown>>
): number {
  let hasHeader: boolean;
  let resultRows: number;
  if (searchResults.isLoading) {
    hasHeader = true;
    resultRows = 1; // For the spinner.
  } else {
    const resultCount = searchResults.results.length;
    hasHeader = Boolean(resultCount);
    resultRows = resultCount;
  }
  return (hasHeader ? 1 : 0) + resultRows;
}
