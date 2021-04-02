// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactChild } from 'react';
import { last } from 'lodash';

import { LeftPaneHelper, ToFindType } from './LeftPaneHelper';
import { getConversationInDirection } from './getConversationInDirection';
import { Row, RowType } from '../ConversationList';
import { PropsData as ConversationListItemPropsType } from '../conversationList/ConversationListItem';
import { LocalizerType } from '../../types/Util';

export type LeftPaneArchivePropsType = {
  archivedConversations: ReadonlyArray<ConversationListItemPropsType>;
};

/* eslint-disable class-methods-use-this */

export class LeftPaneArchiveHelper extends LeftPaneHelper<
  LeftPaneArchivePropsType
> {
  private readonly archivedConversations: ReadonlyArray<
    ConversationListItemPropsType
  >;

  constructor({ archivedConversations }: Readonly<LeftPaneArchivePropsType>) {
    super();

    this.archivedConversations = archivedConversations;
  }

  getHeaderContents({
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

  getBackAction({ showInbox }: { showInbox: () => void }): () => void {
    return showInbox;
  }

  getPreRowsNode({ i18n }: Readonly<{ i18n: LocalizerType }>): ReactChild {
    return (
      <div className="module-left-pane__archive-helper-text">
        {i18n('archiveHelperText')}
      </div>
    );
  }

  getRowCount(): number {
    return this.archivedConversations.length;
  }

  getRow(rowIndex: number): undefined | Row {
    const conversation = this.archivedConversations[rowIndex];
    return conversation
      ? {
          type: RowType.Conversation,
          conversation,
        }
      : undefined;
  }

  getRowIndexToScrollTo(
    selectedConversationId: undefined | string
  ): undefined | number {
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
    const { archivedConversations } = this;
    const conversation =
      archivedConversations[conversationIndex] || last(archivedConversations);
    return conversation ? { conversationId: conversation.id } : undefined;
  }

  getConversationAndMessageInDirection(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    _selectedMessageId: unknown
  ): undefined | { conversationId: string } {
    return getConversationInDirection(
      this.archivedConversations,
      toFind,
      selectedConversationId
    );
  }

  shouldRecomputeRowHeights(_old: unknown): boolean {
    return false;
  }
}
