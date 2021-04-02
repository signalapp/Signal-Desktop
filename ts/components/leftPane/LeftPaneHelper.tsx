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
      startComposing: () => void;
      showChooseGroupMembers: () => void;
    }>
  ): null | ReactChild {
    return null;
  }

  getBackAction(
    _: Readonly<{
      showInbox: () => void;
      startComposing: () => void;
      showChooseGroupMembers: () => void;
    }>
  ): undefined | (() => void) {
    return undefined;
  }

  shouldRenderNetworkStatusAndUpdateDialog(): boolean {
    return false;
  }

  getPreRowsNode(
    _: Readonly<{
      clearGroupCreationError: () => void;
      closeCantAddContactToGroupModal: () => unknown;
      closeMaximumGroupSizeModal: () => unknown;
      closeRecommendedGroupSizeModal: () => unknown;
      createGroup: () => unknown;
      i18n: LocalizerType;
      setComposeGroupAvatar: (_: undefined | ArrayBuffer) => unknown;
      setComposeGroupName: (_: string) => unknown;
      onChangeComposeSearchTerm: (
        event: ChangeEvent<HTMLInputElement>
      ) => unknown;
      removeSelectedContact: (_: string) => unknown;
    }>
  ): null | ReactChild {
    return null;
  }

  getFooterContents(
    _: Readonly<{
      i18n: LocalizerType;
      startSettingGroupMetadata: () => void;
      createGroup: () => unknown;
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

  isScrollable(): boolean {
    return true;
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
