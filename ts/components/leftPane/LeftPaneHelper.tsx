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
import type { DurationInSeconds } from '../../util/durations';
import type { LookupConversationWithoutServiceIdActionsType } from '../../util/lookupConversationWithoutServiceId';
import type { ShowConversationType } from '../../state/ducks/conversations';

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
      i18n: LocalizerType;
      showInbox: () => void;
      startComposing: () => void;
      showChooseGroupMembers: () => void;
    }>
  ): null | ReactChild {
    return null;
  }

  getSearchInput(
    _: Readonly<{
      clearConversationSearch: () => unknown;
      clearSearchQuery: () => unknown;
      endConversationSearch: () => unknown;
      endSearch: () => unknown;
      i18n: LocalizerType;
      onChangeComposeSearchTerm: (
        event: ChangeEvent<HTMLInputElement>
      ) => unknown;
      onChangeComposeSelectedRegion: (newRegion: string) => void;
      updateSearchTerm: (searchTerm: string) => unknown;
      showConversation: ShowConversationType;
      showInbox: () => void;
      updateFilterByUnread: (filterByUnread: boolean) => void;
    }> &
      LookupConversationWithoutServiceIdActionsType
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

  getBackgroundNode(
    _: Readonly<{
      i18n: LocalizerType;
    }>
  ): null | ReactChild {
    return null;
  }

  getPreRowsNode(
    _: Readonly<{
      clearConversationSearch: () => unknown;
      clearGroupCreationError: () => void;
      clearSearchQuery: () => unknown;
      closeMaximumGroupSizeModal: () => unknown;
      closeRecommendedGroupSizeModal: () => unknown;
      composeDeleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
      composeReplaceAvatar: ReplaceAvatarActionType;
      composeSaveAvatarToDisk: SaveAvatarToDiskActionType;
      createGroup: () => unknown;
      i18n: LocalizerType;
      removeSelectedContact: (_: string) => unknown;
      setComposeGroupAvatar: (_: undefined | Uint8Array) => unknown;
      setComposeGroupExpireTimer: (_: DurationInSeconds) => void;
      setComposeGroupName: (_: string) => unknown;
      toggleComposeEditingAvatar: () => unknown;
    }>
  ): null | ReactChild {
    return null;
  }

  getFooterContents(
    _: Readonly<
      {
        i18n: LocalizerType;
        startSettingGroupMetadata: () => void;
        createGroup: () => unknown;
        showInbox: () => void;
        showConversation: ShowConversationType;
      } & LookupConversationWithoutServiceIdActionsType
    >
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
    targetedMessageId: undefined | string
  ): undefined | { conversationId: string; messageId?: string };

  abstract shouldRecomputeRowHeights(old: Readonly<T>): boolean;
}
