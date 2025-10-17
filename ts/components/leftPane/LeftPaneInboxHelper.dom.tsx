// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReactChild, ReactNode } from 'react';
import React from 'react';

import type { ToFindType } from './LeftPaneHelper.dom.js';
import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations.preload.js';
import { LeftPaneHelper } from './LeftPaneHelper.dom.js';
import { getConversationInDirection } from './getConversationInDirection.dom.js';
import type { Row } from '../ConversationList.dom.js';
import { RowType } from '../ConversationList.dom.js';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { handleKeydownForSearch } from './handleKeydownForSearch.dom.js';
import { LeftPaneSearchInput } from '../LeftPaneSearchInput.dom.js';
import type { ChatFolder } from '../../types/ChatFolder.std.js';
import { ChatFolderType } from '../../types/ChatFolder.std.js';
import { AxoButton } from '../../axo/AxoButton.dom.js';
import { NavTab, SettingsPage, type Location } from '../../types/Nav.std.js';
import { tw } from '../../axo/tw.dom.js';

const { last } = lodash;

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
  selectedChatFolder: ChatFolder | null;
  filterByUnread: boolean;
};

export class LeftPaneInboxHelper extends LeftPaneHelper<LeftPaneInboxPropsType> {
  readonly #conversations: ReadonlyArray<ConversationListItemPropsType>;
  readonly #archivedConversations: ReadonlyArray<ConversationListItemPropsType>;
  readonly #pinnedConversations: ReadonlyArray<ConversationListItemPropsType>;
  readonly #isAboutToSearch: boolean;
  readonly #isSearchingGlobally: boolean;
  readonly #startSearchCounter: number;
  readonly #searchDisabled: boolean;
  readonly #searchTerm: string;
  readonly #searchConversation: undefined | ConversationType;
  readonly #selectedChatFolder: ChatFolder | null;
  readonly #filterByUnread: boolean;

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
    selectedChatFolder,
    filterByUnread,
  }: Readonly<LeftPaneInboxPropsType>) {
    super();

    this.#conversations = conversations;
    this.#archivedConversations = archivedConversations;
    this.#pinnedConversations = pinnedConversations;
    this.#isAboutToSearch = isAboutToSearch;
    this.#isSearchingGlobally = isSearchingGlobally;
    this.#startSearchCounter = startSearchCounter;
    this.#searchDisabled = searchDisabled;
    this.#searchTerm = searchTerm;
    this.#searchConversation = searchConversation;
    this.#selectedChatFolder = selectedChatFolder;
    this.#filterByUnread = filterByUnread;
  }

  getRowCount(): number {
    let headerCount = 0;
    if (this.#hasPinned()) {
      headerCount += 1;

      if (this.#hasNotPinned()) {
        headerCount += 1;
      }
    }
    const buttonCount = this.#shouldShowArchiveButton() ? 1 : 0;
    return (
      headerCount +
      this.#pinnedConversations.length +
      this.#conversations.length +
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
        disabled={this.#searchDisabled}
        i18n={i18n}
        isSearchingGlobally={this.#isSearchingGlobally}
        searchConversation={this.#searchConversation}
        searchTerm={this.#searchTerm}
        showConversation={showConversation}
        startSearchCounter={this.#startSearchCounter}
        updateSearchTerm={updateSearchTerm}
        onFilterClick={updateFilterByUnread}
        filterButtonEnabled={!this.#searchConversation}
        filterPressed={this.#filterByUnread}
      />
    );
  }

  override getPreRowsNode({
    renderLeftPaneChatFolders,
  }: Readonly<{
    renderLeftPaneChatFolders: () => JSX.Element;
  }>): ReactChild {
    return renderLeftPaneChatFolders();
  }

  override getEmptyViewNode({
    i18n,
    selectedChatFolder,
    changeLocation,
  }: Readonly<{
    i18n: LocalizerType;
    selectedChatFolder: ChatFolder | null;
    changeLocation: (location: Location) => void;
  }>): ReactChild | null {
    if (this.getRowCount() === 0) {
      if (selectedChatFolder?.folderType === ChatFolderType.CUSTOM) {
        return (
          <EmptyView>
            <h3 className={tw('type-body-large text-label-primary')}>
              {i18n('icu:LeftPane__EmptyView--WithSelectedChatFolder')}
            </h3>
            <AxoButton.Root
              variant="floating-secondary"
              size="medium"
              onClick={() => {
                changeLocation({
                  tab: NavTab.Settings,
                  details: {
                    page: SettingsPage.EditChatFolder,
                    chatFolderId: selectedChatFolder.id,
                    initChatFolderParams: null,
                    previousLocation: {
                      tab: NavTab.Chats,
                    },
                  },
                });
              }}
            >
              {i18n(
                'icu:LeftPane__EmptyView--WithSelectedChatFolder__FolderSettings'
              )}
            </AxoButton.Root>
          </EmptyView>
        );
      }

      return (
        <EmptyView>
          <h3 className={tw('type-title-medium text-label-secondary')}>
            {i18n('icu:emptyInbox__title')}
          </h3>
          <p className={tw('type-body-medium text-label-secondary')}>
            {i18n('icu:emptyInbox__subtitle')}
          </p>
        </EmptyView>
      );
    }

    return null;
  }

  #shouldShowArchiveButton(): boolean {
    if (this.#archivedConversations.length === 0) {
      return false;
    }

    if (
      this.#selectedChatFolder != null &&
      this.#selectedChatFolder.folderType !== ChatFolderType.ALL
    ) {
      return false;
    }

    return true;
  }

  getRow(rowIndex: number): undefined | Row {
    const pinnedConversations = this.#pinnedConversations;
    const archivedConversations = this.#archivedConversations;
    const conversations = this.#conversations;

    const archivedConversationsCount = archivedConversations.length;

    let index = rowIndex;

    if (this.#hasPinned()) {
      if (index === 0) {
        return {
          type: RowType.Header,
          getHeaderText: i18n => i18n('icu:LeftPane--pinned'),
        };
      }
      index -= 1;

      if (index < pinnedConversations.length) {
        return {
          type: RowType.Conversation,
          conversation: pinnedConversations[index],
        };
      }
      index -= pinnedConversations.length;

      if (this.#hasNotPinned()) {
        if (index === 0) {
          return {
            type: RowType.Header,
            getHeaderText: i18n => i18n('icu:LeftPane--chats'),
          };
        }

        index -= 1;
      }
    }

    if (index < conversations.length) {
      return {
        type: RowType.Conversation,
        conversation: conversations[index],
      };
    }
    index -= conversations.length;

    if (index === 0 && this.#shouldShowArchiveButton()) {
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

    const pinnedConversationIndex = this.#pinnedConversations.findIndex(
      isConversationSelected
    );
    if (pinnedConversationIndex !== -1) {
      return pinnedConversationIndex + 1;
    }

    const conversationIndex = this.#conversations.findIndex(
      isConversationSelected
    );
    if (conversationIndex !== -1) {
      const pinnedOffset = this.#pinnedConversations.length;
      const headerOffset = this.#hasPinned() ? 2 : 0;
      return conversationIndex + pinnedOffset + headerOffset;
    }

    return undefined;
  }

  override requiresFullWidth(): boolean {
    const hasNoConversations =
      !this.#conversations.length &&
      !this.#pinnedConversations.length &&
      !this.#archivedConversations.length;
    return hasNoConversations || this.#isAboutToSearch;
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneInboxPropsType>): boolean {
    return old.pinnedConversations.length !== this.#pinnedConversations.length;
  }

  getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string } {
    const pinnedConversations = this.#pinnedConversations;
    const conversations = this.#conversations;
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
      [...this.#pinnedConversations, ...this.#conversations],
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

  #hasPinned(): boolean {
    return this.#pinnedConversations.length !== 0;
  }

  #hasNotPinned(): boolean {
    return this.#conversations.length !== 0;
  }
}

function EmptyView(props: { children: ReactNode }) {
  return (
    <div
      className={tw('flex h-full flex-col items-center justify-center gap-3')}
    >
      {props.children}
    </div>
  );
}
