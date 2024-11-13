// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { last } from 'lodash';
import type { ReactChild } from 'react';
import React from 'react';

import type { ToFindType } from './LeftPaneHelper';
import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations';
import { LeftPaneHelper } from './LeftPaneHelper';
import { getConversationInDirection } from './getConversationInDirection';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import { NavSidebarEmpty } from '../NavSidebar';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import type { LocalizerType } from '../../types/Util';
import { handleKeydownForSearch } from './handleKeydownForSearch';
import { LeftPaneSearchInput } from '../LeftPaneSearchInput';

export type LeftPaneInboxPropsType = {
  conversations: ReadonlyArray<ConversationListItemPropsType>;
  archivedConversations: ReadonlyArray<ConversationListItemPropsType>;
  pinnedConversations: ReadonlyArray<ConversationListItemPropsType>;
  isAboutToSearch: boolean;
  isSearchingGlobally: boolean;
  startSearchCounter: number;
  searchDisabled: boolean;
  searchTerm: string;
  searchConversation: undefined | ConversationType;
  filterByUnread: boolean;
};

export class LeftPaneInboxHelper extends LeftPaneHelper<LeftPaneInboxPropsType> {
  private readonly conversations: ReadonlyArray<ConversationListItemPropsType>;

  private readonly archivedConversations: ReadonlyArray<ConversationListItemPropsType>;

  private readonly pinnedConversations: ReadonlyArray<ConversationListItemPropsType>;

  private readonly isAboutToSearch: boolean;

  private readonly isSearchingGlobally: boolean;

  private readonly startSearchCounter: number;

  private readonly searchDisabled: boolean;

  private readonly searchTerm: string;

  private readonly searchConversation: undefined | ConversationType;

  private readonly filterByUnread: boolean;

  constructor({
    conversations,
    archivedConversations,
    pinnedConversations,
    isAboutToSearch,
    isSearchingGlobally,
    startSearchCounter,
    searchDisabled,
    searchTerm,
    searchConversation,
    filterByUnread,
  }: Readonly<LeftPaneInboxPropsType>) {
    super();

    this.conversations = conversations;
    this.archivedConversations = archivedConversations;
    this.pinnedConversations = pinnedConversations;
    this.isAboutToSearch = isAboutToSearch;
    this.isSearchingGlobally = isSearchingGlobally;
    this.startSearchCounter = startSearchCounter;
    this.searchDisabled = searchDisabled;
    this.searchTerm = searchTerm;
    this.searchConversation = searchConversation;
    this.filterByUnread = filterByUnread;
  }

  getRowCount(): number {
    const headerCount = this.hasPinnedAndNonpinned() ? 2 : 0;
    const buttonCount = this.archivedConversations.length ? 1 : 0;
    return (
      headerCount +
      this.pinnedConversations.length +
      this.conversations.length +
      buttonCount
    );
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
        disabled={this.searchDisabled}
        i18n={i18n}
        isSearchingGlobally={this.isSearchingGlobally}
        searchConversation={this.searchConversation}
        searchTerm={this.searchTerm}
        showConversation={showConversation}
        startSearchCounter={this.startSearchCounter}
        updateSearchTerm={updateSearchTerm}
        onFilterClick={updateFilterByUnread}
        filterButtonEnabled={!this.searchConversation}
        filterPressed={this.filterByUnread}
      />
    );
  }

  override getBackgroundNode({
    i18n,
  }: Readonly<{
    i18n: LocalizerType;
  }>): ReactChild | null {
    if (this.getRowCount() === 0) {
      return (
        <NavSidebarEmpty
          title={i18n('icu:emptyInbox__title')}
          subtitle={i18n('icu:emptyInbox__subtitle')}
        />
      );
    }

    return null;
  }

  getRow(rowIndex: number): undefined | Row {
    const { conversations, archivedConversations, pinnedConversations } = this;

    const archivedConversationsCount = archivedConversations.length;

    if (this.hasPinnedAndNonpinned()) {
      switch (rowIndex) {
        case 0:
          return {
            type: RowType.Header,
            getHeaderText: i18n => i18n('icu:LeftPane--pinned'),
          };
        case pinnedConversations.length + 1:
          return {
            type: RowType.Header,
            getHeaderText: i18n => i18n('icu:LeftPane--chats'),
          };
        case pinnedConversations.length + conversations.length + 2:
          if (archivedConversationsCount) {
            return {
              type: RowType.ArchiveButton,
              archivedConversationsCount,
            };
          }
          return undefined;
        default: {
          const pinnedConversation = pinnedConversations[rowIndex - 1];
          if (pinnedConversation) {
            return {
              type: RowType.Conversation,
              conversation: pinnedConversation,
            };
          }
          const conversation =
            conversations[rowIndex - pinnedConversations.length - 2];
          return conversation
            ? {
                type: RowType.Conversation,
                conversation,
              }
            : undefined;
        }
      }
    }

    const onlyConversations = pinnedConversations.length
      ? pinnedConversations
      : conversations;
    if (rowIndex < onlyConversations.length) {
      const conversation = onlyConversations[rowIndex];
      return conversation
        ? {
            type: RowType.Conversation,
            conversation,
          }
        : undefined;
    }

    if (rowIndex === onlyConversations.length && archivedConversationsCount) {
      return {
        type: RowType.ArchiveButton,
        archivedConversationsCount,
      };
    }

    return undefined;
  }

  override getRowIndexToScrollTo(
    selectedConversationId: undefined | string
  ): undefined | number {
    if (!selectedConversationId) {
      return undefined;
    }

    const isConversationSelected = (
      conversation: Readonly<ConversationListItemPropsType>
    ) => conversation.id === selectedConversationId;
    const hasHeaders = this.hasPinnedAndNonpinned();

    const pinnedConversationIndex = this.pinnedConversations.findIndex(
      isConversationSelected
    );
    if (pinnedConversationIndex !== -1) {
      const headerOffset = hasHeaders ? 1 : 0;
      return pinnedConversationIndex + headerOffset;
    }

    const conversationIndex = this.conversations.findIndex(
      isConversationSelected
    );
    if (conversationIndex !== -1) {
      const pinnedOffset = this.pinnedConversations.length;
      const headerOffset = hasHeaders ? 2 : 0;
      return conversationIndex + pinnedOffset + headerOffset;
    }

    return undefined;
  }

  override requiresFullWidth(): boolean {
    const hasNoConversations =
      !this.conversations.length &&
      !this.pinnedConversations.length &&
      !this.archivedConversations.length;
    return hasNoConversations || this.isAboutToSearch;
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneInboxPropsType>): boolean {
    return old.pinnedConversations.length !== this.pinnedConversations.length;
  }

  getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string } {
    const { conversations, pinnedConversations } = this;
    const conversation =
      pinnedConversations[conversationIndex] ||
      conversations[conversationIndex - pinnedConversations.length] ||
      last(conversations) ||
      last(pinnedConversations);
    return conversation ? { conversationId: conversation.id } : undefined;
  }

  getConversationAndMessageInDirection(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    _targetedMessageId: unknown
  ): undefined | { conversationId: string } {
    return getConversationInDirection(
      [...this.pinnedConversations, ...this.conversations],
      toFind,
      selectedConversationId
    );
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

  private hasPinnedAndNonpinned(): boolean {
    return Boolean(
      this.pinnedConversations.length && this.conversations.length
    );
  }
}
