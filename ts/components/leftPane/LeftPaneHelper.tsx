// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ChangeEvent, ReactChild } from 'react';

import { Row } from '../ConversationList';
import { LocalizerType } from '../../types/Util';

export enum FindDirection {
  Up,
  Down,
}

export type ToFindType = {
  direction: FindDirection;
  unreadOnly: boolean;
};

/* eslint-disable class-methods-use-this */

export abstract class LeftPaneHelper<T> {
  getHeaderContents(
    _: Readonly<{
      i18n: LocalizerType;
      showInbox: () => void;
    }>
  ): null | ReactChild {
    return null;
  }

  shouldRenderNetworkStatusAndUpdateDialog(): boolean {
    return false;
  }

  getPreRowsNode(
    _: Readonly<{
      i18n: LocalizerType;
      onChangeComposeSearchTerm: (
        event: ChangeEvent<HTMLInputElement>
      ) => unknown;
    }>
  ): null | ReactChild {
    return null;
  }

  abstract getRowCount(): number;

  abstract getRow(rowIndex: number): undefined | Row;

  getRowIndexToScrollTo(
    _selectedConversationId: undefined | string
  ): undefined | number {
    return undefined;
  }

  abstract getConversationAndMessageAtIndex(
    conversationIndex: number
  ): undefined | { conversationId: string; messageId?: string };

  abstract getConversationAndMessageInDirection(
    toFind: Readonly<ToFindType>,
    selectedConversationId: undefined | string,
    selectedMessageId: undefined | string
  ): undefined | { conversationId: string; messageId?: string };

  abstract shouldRecomputeRowHeights(old: Readonly<T>): boolean;
}
