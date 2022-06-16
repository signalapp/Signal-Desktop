// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React from 'react';
import { last } from 'lodash';

import type { ToFindType } from './LeftPaneHelper';
import { LeftPaneHelper } from './LeftPaneHelper';
import { getConversationInDirection } from './getConversationInDirection';
import type { Row } from '../ConversationList';
import { RowType } from '../ConversationList';
import type { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import type { LocalizerType } from '../../types/Util';
import type {
  ConversationType,
  ShowConversationType,
} from '../../state/ducks/conversations';
import { LeftPaneSearchInput } from '../LeftPaneSearchInput';
import type { LeftPaneSearchPropsType } from './LeftPaneSearchHelper';
import { LeftPaneSearchHelper } from './LeftPaneSearchHelper';
import * as KeyboardLayout from '../../services/keyboardLayout';

type LeftPaneArchiveBasePropsType = {
  archivedConversations: ReadonlyArray<ConversationListItemPropsType>;
  searchConversation: undefined | ConversationType;
  searchTerm: string;
  startSearchCounter: number;
};

export type LeftPaneArchivePropsType =
  | LeftPaneArchiveBasePropsType
  | (LeftPaneArchiveBasePropsType & LeftPaneSearchPropsType);

export class LeftPaneArchiveHelper extends LeftPaneHelper<LeftPaneArchivePropsType> {
  private readonly archivedConversations: ReadonlyArray<ConversationListItemPropsType>;

  private readonly searchConversation: undefined | ConversationType;

  private readonly searchTerm: string;

  private readonly searchHelper: undefined | LeftPaneSearchHelper;

  private readonly startSearchCounter: number;

  constructor(props: Readonly<LeftPaneArchivePropsType>) {
    super();

    this.archivedConversations = props.archivedConversations;
    this.searchConversation = props.searchConversation;
    this.searchTerm = props.searchTerm;
    this.startSearchCounter = props.startSearchCounter;

    if ('conversationResults' in props) {
      this.searchHelper = new LeftPaneSearchHelper(props);
    }
  }

  override getHeaderContents({
    i18n,
    showInbox,
  }: Readonly<{
    i18n: LocalizerType;
    showInbox: () => void;
  }>): ReactChild {
    return (
      <div className="module-left-pane__header__contents">
        <button
          onClick={this.getBackAction({ showInbox })}
          className="module-left-pane__header__contents__back-button"
          title={i18n('backToInbox')}
          aria-label={i18n('backToInbox')}
          type="button"
        />
        <div className="module-left-pane__header__contents__text">
          {i18n('archivedConversations')}
        </div>
      </div>
    );
  }

  override getSearchInput({
    clearConversationSearch,
    clearSearch,
    i18n,
    updateSearchTerm,
    showConversation,
  }: Readonly<{
    clearConversationSearch: () => unknown;
    clearSearch: () => unknown;
    i18n: LocalizerType;
    updateSearchTerm: (searchTerm: string) => unknown;
    showConversation: ShowConversationType;
  }>): ReactChild | null {
    if (!this.searchConversation) {
      return null;
    }

    return (
      <LeftPaneSearchInput
        clearConversationSearch={clearConversationSearch}
        clearSearch={clearSearch}
        i18n={i18n}
        searchConversation={this.searchConversation}
        searchTerm={this.searchTerm}
        showConversation={showConversation}
        startSearchCounter={this.startSearchCounter}
        updateSearchTerm={updateSearchTerm}
      />
    );
  }

  override getBackAction({ showInbox }: { showInbox: () => void }): () => void {
    return showInbox;
  }

  override getPreRowsNode({
    i18n,
  }: Readonly<{ i18n: LocalizerType }>): ReactChild | null {
    if (this.searchHelper) {
      return this.searchHelper.getPreRowsNode({ i18n });
    }

    return (
      <div className="module-left-pane__archive-helper-text">
        {this.getRowCount() > 0
          ? i18n('archiveHelperText')
          : i18n('noArchivedConversations')}
      </div>
    );
  }

  getRowCount(): number {
    return (
      this.searchHelper?.getRowCount() ?? this.archivedConversations.length
    );
  }

  getRow(rowIndex: number): undefined | Row {
    if (this.searchHelper) {
      return this.searchHelper.getRow(rowIndex);
    }

    const conversation = this.archivedConversations[rowIndex];
    return conversation
      ? {
          type: RowType.Conversation,
          conversation,
        }
      : undefined;
  }

  override getRowIndexToScrollTo(
    selectedConversationId: undefined | string
  ): undefined | number {
    if (this.searchHelper) {
      return this.searchHelper.getRowIndexToScrollTo(selectedConversationId);
    }

    if (!selectedConversationId) {
      return undefined;
    }
    const result = this.archivedConversations.findIndex(
      conversation => conversation.id === selectedConversationId
    );
    return result === -1 ? undefined : result;
  }

  getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string } {
    const { archivedConversations, searchHelper } = this;

    if (searchHelper) {
      return searchHelper.getConversationAndMessageAtIndex(conversationIndex);
    }

    const conversation =
      archivedConversations[conversationIndex] || last(archivedConversations);
    return conversation ? { conversationId: conversation.id } : undefined;
  }

  getConversationAndMessageInDirection(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    selectedMessageId: unknown
  ): undefined | { conversationId: string } {
    if (this.searchHelper) {
      return this.searchHelper.getConversationAndMessageInDirection(
        toFind,
        selectedConversationId,
        selectedMessageId
      );
    }

    return getConversationInDirection(
      this.archivedConversations,
      toFind,
      selectedConversationId
    );
  }

  shouldRecomputeRowHeights(old: Readonly<LeftPaneArchivePropsType>): boolean {
    const hasSearchingChanged =
      'conversationResults' in old !== Boolean(this.searchHelper);
    if (hasSearchingChanged) {
      return true;
    }

    if ('conversationResults' in old && this.searchHelper) {
      return this.searchHelper.shouldRecomputeRowHeights(old);
    }

    return false;
  }

  override onKeyDown(
    event: KeyboardEvent,
    {
      searchInConversation,
      selectedConversationId,
    }: Readonly<{
      searchInConversation: (conversationId: string) => unknown;
      selectedConversationId: undefined | string;
    }>
  ): void {
    if (!selectedConversationId) {
      return;
    }

    const { ctrlKey, metaKey, shiftKey } = event;
    const commandKey = window.platform === 'darwin' && metaKey;
    const controlKey = window.platform !== 'darwin' && ctrlKey;
    const commandOrCtrl = commandKey || controlKey;
    const commandAndCtrl = commandKey && ctrlKey;
    const key = KeyboardLayout.lookup(event);

    if (
      commandOrCtrl &&
      !commandAndCtrl &&
      shiftKey &&
      (key === 'f' || key === 'F') &&
      this.archivedConversations.some(({ id }) => id === selectedConversationId)
    ) {
      searchInConversation(selectedConversationId);

      event.preventDefault();
      event.stopPropagation();
    }
  }
}
