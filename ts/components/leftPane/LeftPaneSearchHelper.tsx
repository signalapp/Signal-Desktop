// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild } from 'react';

import { first, last, flatten, isEmpty } from 'lodash';

import { LeftPaneHelper, ToFindType, FindDirection } from './LeftPaneHelper';
import { LocalizerType } from '../../types/Util';
import { Row, RowType } from '../ConversationList';
import { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';

import { Intl } from '../Intl';
import { Emojify } from '../conversation/Emojify';
import { assert } from '../../util/assert';
import { getConversationInDirection } from './getConversationInDirection';

// The "correct" thing to do is to measure the size of the left pane and render enough
//   search results for the container height. But (1) that's slow (2) the list is
//   virtualized (3) 99 rows is over 6000px tall, taller than most monitors (4) it's fine
//   if, in some extremely tall window, we have some empty space. So we just hard-code a
//   fairly big number.
const SEARCH_RESULTS_FAKE_ROW_COUNT = 99;

type MaybeLoadedSearchResultsType<T> =
  | { isLoading: true }
  | { isLoading: false; results: Array<T> };

type MessageResultsType = {
  id: string;
  conversationId: string;
};

export type LeftPaneSearchPropsType = {
  conversationResults: MaybeLoadedSearchResultsType<
    ConversationListItemPropsType
  >;
  contactResults: MaybeLoadedSearchResultsType<ConversationListItemPropsType>;
  messageResults: MaybeLoadedSearchResultsType<MessageResultsType>;
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

  private readonly messageResults: MaybeLoadedSearchResultsType<
    MessageResultsType
  >;

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

  getConversationAndMessageInDirection(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    selectedMessageId: undefined | string
  ): undefined | { conversationId: string; messageId?: string } {
    if (this.isLoading()) {
      return undefined;
    }

    return (
      this.getMessageInDirectionIfNeeded(
        toFind,
        selectedMessageId,
        selectedConversationId
      ) ??
      getConversationInDirection(
        this.loadedConversationResults(),
        toFind,
        selectedMessageId ? undefined : selectedConversationId
      )
    );
  }

  private shouldLookupMessages(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    selectedMessageId: undefined | string
  ): boolean {
    const messageResults = this.loadedMessageResults();
    const conversationResults = this.loadedConversationResults();
    const firstConversation = first(conversationResults);
    const lastConversation = last(conversationResults);

    if (toFind.unreadOnly || isEmpty(messageResults)) {
      return false;
    }

    const goingUpToMessages =
      toFind.direction === FindDirection.Up &&
      (!selectedConversationId ||
        firstConversation?.id === selectedConversationId ||
        conversationResults.every(({ id }) => id !== selectedConversationId));

    const goingDownToMessages =
      toFind.direction === FindDirection.Down &&
      (isEmpty(conversationResults) ||
        lastConversation?.id === selectedConversationId);

    const browsingMessages = messageResults.some(
      ({ id }) => id === selectedMessageId
    );

    return goingUpToMessages || goingDownToMessages || browsingMessages;
  }

  private getMessageInDirectionIfNeeded(
    toFind: Readonly<ToFindType>,
    selectedMessageId: undefined | string,
    selectedConversationId: undefined | string
  ): { conversationId: string; messageId: string } | undefined {
    const shouldLookupMessages = this.shouldLookupMessages(
      toFind,
      selectedConversationId,
      selectedMessageId
    );

    if (shouldLookupMessages) {
      return getMessageInDirection(
        this.loadedMessageResults(),
        toFind,
        selectedMessageId
      );
    }

    return undefined;
  }

  private allResults() {
    return [this.conversationResults, this.contactResults, this.messageResults];
  }

  private isLoading(): boolean {
    return this.allResults().some(results => results.isLoading);
  }

  private loadedConversationResults(): Array<ConversationListItemPropsType> {
    // can't use `this.isLoading` because typescript does not follow along
    if (this.conversationResults.isLoading || this.contactResults.isLoading) {
      return [];
    }

    return flatten(
      [this.conversationResults, this.contactResults].map(
        ({ results }) => results
      )
    );
  }

  private loadedMessageResults(): Array<MessageResultsType> {
    if (this.messageResults.isLoading) {
      return [];
    }

    return this.messageResults.results;
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

function formatMessageResult(
  message: MessageResultsType
): { conversationId: string; messageId: string } {
  return {
    conversationId: message.conversationId,
    messageId: message.id,
  };
}

function getMessageInDirection(
  messages: ReadonlyArray<MessageResultsType>,
  toFind: Readonly<ToFindType>,
  selectedMessageId: undefined | string
): { conversationId: string; messageId: string } | undefined {
  if (messages.length === 0) {
    return undefined;
  }

  if (selectedMessageId === undefined) {
    return formatMessageResult(
      toFind.direction === FindDirection.Down
        ? messages[0]
        : messages[messages.length - 1]
    );
  }

  const currentIdx = messages.findIndex(({ id }) => id === selectedMessageId);

  const resultIdx =
    toFind.direction === FindDirection.Down ? currentIdx + 1 : currentIdx - 1;

  const result = messages[resultIdx];

  return result ? formatMessageResult(result) : undefined;
}
