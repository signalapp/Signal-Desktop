// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useContext } from 'react';
import { useSelector } from 'react-redux';
import { LeftPaneChatFolders } from '../../components/leftPane/LeftPaneChatFolders.js';
import {
  getSelectedChatFolder,
  getSortedChatFolders,
} from '../selectors/chatFolders.js';
import { getIntl } from '../selectors/user.js';
import {
  getAllChatFoldersMutedStats,
  getAllChatFoldersUnreadStats,
} from '../selectors/conversations.js';
import { useChatFolderActions } from '../ducks/chatFolders.js';
import { NavSidebarWidthBreakpointContext } from '../../components/NavSidebar.js';
import { useNavActions } from '../ducks/nav.js';
import { NavTab, SettingsPage } from '../../types/Nav.js';
import {
  isChatFoldersEnabled,
  type ChatFolderId,
} from '../../types/ChatFolder.js';
import { getSelectedLocation } from '../selectors/nav.js';
import { useConversationsActions } from '../ducks/conversations.js';

export const SmartLeftPaneChatFolders = memo(
  function SmartLeftPaneChatFolders() {
    const i18n = useSelector(getIntl);
    const sortedChatFolders = useSelector(getSortedChatFolders);
    const allChatFoldersUnreadStats = useSelector(getAllChatFoldersUnreadStats);
    const allChatFoldersMutedStats = useSelector(getAllChatFoldersMutedStats);
    const selectedChatFolder = useSelector(getSelectedChatFolder);
    const navSidebarWidthBreakpoint = useContext(
      NavSidebarWidthBreakpointContext
    );
    const location = useSelector(getSelectedLocation);

    const { updateSelectedChangeFolderId } = useChatFolderActions();
    const { changeLocation } = useNavActions();
    const { markChatFolderRead, setChatFolderMuteExpiration } =
      useConversationsActions();

    const handleChatFolderOpenSettings = useCallback(
      (chatFolderId: ChatFolderId) => {
        changeLocation({
          tab: NavTab.Settings,
          details: {
            page: SettingsPage.EditChatFolder,
            chatFolderId,
            previousLocation: location,
          },
        });
      },
      [changeLocation, location]
    );

    if (!isChatFoldersEnabled()) {
      return null;
    }

    return (
      <LeftPaneChatFolders
        i18n={i18n}
        navSidebarWidthBreakpoint={navSidebarWidthBreakpoint}
        sortedChatFolders={sortedChatFolders}
        allChatFoldersUnreadStats={allChatFoldersUnreadStats}
        allChatFoldersMutedStats={allChatFoldersMutedStats}
        selectedChatFolder={selectedChatFolder}
        onSelectedChatFolderIdChange={updateSelectedChangeFolderId}
        onChatFolderMarkRead={markChatFolderRead}
        onChatFolderUpdateMute={setChatFolderMuteExpiration}
        onChatFolderOpenSettings={handleChatFolderOpenSettings}
      />
    );
  }
);
