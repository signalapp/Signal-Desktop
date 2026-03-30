// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useContext } from 'react';
import { useSelector } from 'react-redux';
import { LeftPaneChatFolders } from '../../components/leftPane/LeftPaneChatFolders.dom.tsx';
import {
  getCurrentChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import {
  getAllChatFoldersMutedStats,
  getAllChatFoldersUnreadStats,
} from '../selectors/conversations.dom.ts';
import { useChatFolderActions } from '../ducks/chatFolders.preload.ts';
import { NavSidebarWidthBreakpointContext } from '../../components/NavSidebar.dom.tsx';
import { useNavActions } from '../ducks/nav.std.ts';
import { NavTab, SettingsPage } from '../../types/Nav.std.ts';
import type { ChatFolderId } from '../../types/ChatFolder.std.ts';
import { getSelectedLocation } from '../selectors/nav.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';

export const SmartLeftPaneChatFolders = memo(
  function SmartLeftPaneChatFolders() {
    const i18n = useSelector(getIntl);
    const currentChatFolders = useSelector(getCurrentChatFolders);
    const allChatFoldersUnreadStats = useSelector(getAllChatFoldersUnreadStats);
    const allChatFoldersMutedStats = useSelector(getAllChatFoldersMutedStats);
    const selectedChatFolder = useSelector(getSelectedChatFolder);
    const navSidebarWidthBreakpoint = useContext(
      NavSidebarWidthBreakpointContext
    );
    const location = useSelector(getSelectedLocation);

    const { updateSelectedChatFolderId } = useChatFolderActions();
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
            initChatFolderParams: null,
            previousLocation: location,
          },
        });
      },
      [changeLocation, location]
    );

    return (
      <LeftPaneChatFolders
        i18n={i18n}
        navSidebarWidthBreakpoint={navSidebarWidthBreakpoint}
        currentChatFolders={currentChatFolders}
        allChatFoldersUnreadStats={allChatFoldersUnreadStats}
        allChatFoldersMutedStats={allChatFoldersMutedStats}
        selectedChatFolder={selectedChatFolder}
        onSelectedChatFolderIdChange={updateSelectedChatFolderId}
        onChatFolderMarkRead={markChatFolderRead}
        onChatFolderUpdateMute={setChatFolderMuteExpiration}
        onChatFolderOpenSettings={handleChatFolderOpenSettings}
      />
    );
  }
);
