// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent, ReactChild } from 'react';

import type { Row } from '../ConversationList';
import type { LocalizerType } from '../../types/Util';
import type {
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../types/Avatar';

export enum FindDirection {
  Up,
  Down,
}

export type ToFindType = {
  direction: FindDirection;
  unreadOnly: boolean;
};

export abstract class LeftPaneHelper<T> {
  getHeaderContents(
    _: Readonly<{
      clearSearch: () => void;
      i18n: LocalizerType;
      showInbox: () => void;
      startComposing: () => void;
      showChooseGroupMembers: () => void;
      updateSearchTerm: (query: string) => void;
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

  getPreRowsNode(
    _: Readonly<{
      clearGroupCreationError: () => void;
      closeCantAddContactToGroupModal: () => unknown;
      closeMaximumGroupSizeModal: () => unknown;
      closeRecommendedGroupSizeModal: () => unknown;
      composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
      composeReplaceAvatar: ReplaceAvatarActionType;
      composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
      createGroup: () => unknown;
      i18n: LocalizerType;
      setComposeGroupAvatar: (_: undefined | Uint8Array) => unknown;
      setComposeGroupName: (_: string) => unknown;
      setComposeGroupExpireTimer: (_: number) => void;
      onChangeComposeSearchTerm: (
        event: ChangeEvent<HTMLInputElement>
      ) => unknown;
      removeSelectedContact: (_: string) => unknown;
      toggleComposeEditingAvatar: () => unknown;
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

  requiresFullWidth(): boolean {
    return true;
  }

  onKeyDown(
    _event: KeyboardEvent,
    _options: Readonly<{
      searchInConversation: (conversationId: string) => unknown;
      selectedConversationId: undefined | string;
      startSearch: () => unknown;
    }>
  ): void {
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
