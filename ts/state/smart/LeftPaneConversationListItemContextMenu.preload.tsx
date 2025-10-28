// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC } from 'react';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import { getConversationByIdSelector } from '../selectors/conversations.dom.js';
import type { ChatFolderToggleChat } from '../../components/leftPane/LeftPaneConversationListItemContextMenu.dom.js';
import { LeftPaneConversationListItemContextMenu } from '../../components/leftPane/LeftPaneConversationListItemContextMenu.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import type { RenderConversationListItemContextMenuProps } from '../../components/conversationList/BaseConversationListItem.dom.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { getLocalDeleteWarningShown } from '../selectors/items.dom.js';
import { useItemsActions } from '../ducks/items.preload.js';
import {
  getCurrentChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.js';
import { useChatFolderActions } from '../ducks/chatFolders.preload.js';
import { useNavActions } from '../ducks/nav.std.js';
import { NavTab, SettingsPage } from '../../types/Nav.std.js';
import type { ChatFolderParams } from '../../types/ChatFolder.std.js';
import { getSelectedLocation } from '../selectors/nav.preload.js';
import { getIsActivelySearching } from '../selectors/search.dom.js';

export const SmartLeftPaneConversationListItemContextMenu: FC<RenderConversationListItemContextMenuProps> =
  memo(function SmartLeftPaneConversationListItemContextMenu(props) {
    const i18n = useSelector(getIntl);
    const conversationByIdSelector = useSelector(getConversationByIdSelector);
    const localDeleteWarningShown = useSelector(getLocalDeleteWarningShown);
    const location = useSelector(getSelectedLocation);
    const isActivelySearching = useSelector(getIsActivelySearching);
    const selectedChatFolder = useSelector(getSelectedChatFolder);
    const currentChatFolders = useSelector(getCurrentChatFolders);

    const {
      onMarkUnread,
      markConversationRead,
      setPinned,
      onArchive,
      onMoveToInbox,
      deleteConversation,
      setMuteExpiration,
    } = useConversationsActions();
    const { updateChatFolderToggleChat } = useChatFolderActions();
    const { putItem } = useItemsActions();
    const { changeLocation } = useNavActions();

    const setLocalDeleteWarningShown = useCallback(() => {
      putItem('localDeleteWarningShown', true);
    }, [putItem]);

    const conversation = conversationByIdSelector(props.conversationId);
    strictAssert(conversation, 'Missing conversation');

    const handlePin = useCallback(
      (conversationId: string) => {
        setPinned(conversationId, true);
      },
      [setPinned]
    );

    const handleUnpin = useCallback(
      (conversationId: string) => {
        setPinned(conversationId, false);
      },
      [setPinned]
    );

    const handleChatFolderOpenCreatePage = useCallback(
      (initChatFolderParams: ChatFolderParams) => {
        changeLocation({
          tab: NavTab.Settings,
          details: {
            page: SettingsPage.EditChatFolder,
            chatFolderId: null,
            initChatFolderParams,
            previousLocation: location,
          },
        });
      },
      [changeLocation, location]
    );

    const handleChatFolderToggleChat: ChatFolderToggleChat = useCallback(
      (chatFolderId, conversationId, toggle) => {
        updateChatFolderToggleChat(chatFolderId, conversationId, toggle, true);
      },
      [updateChatFolderToggleChat]
    );

    return (
      <LeftPaneConversationListItemContextMenu
        i18n={i18n}
        conversation={conversation}
        selectedChatFolder={selectedChatFolder}
        currentChatFolders={currentChatFolders}
        isActivelySearching={isActivelySearching}
        onMarkUnread={onMarkUnread}
        onMarkRead={markConversationRead}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onUpdateMute={setMuteExpiration}
        onArchive={onArchive}
        onUnarchive={onMoveToInbox}
        onDelete={deleteConversation}
        onChatFolderOpenCreatePage={handleChatFolderOpenCreatePage}
        onChatFolderToggleChat={handleChatFolderToggleChat}
        localDeleteWarningShown={localDeleteWarningShown}
        setLocalDeleteWarningShown={setLocalDeleteWarningShown}
      >
        {props.children}
      </LeftPaneConversationListItemContextMenu>
    );
  });
