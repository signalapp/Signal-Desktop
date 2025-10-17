// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useContext } from 'react';
import { useSelector } from 'react-redux';
import { LeftPaneChatFolders } from '../../components/leftPane/LeftPaneChatFolders.dom.js';
import {
  getCurrentChatFolders,
  getSelectedChatFolder,
} from '../selectors/chatFolders.std.js';
import { getIntl } from '../selectors/user.std.js';
import {
  getAllChatFoldersMutedStats,
  getAllChatFoldersUnreadStats,
} from '../selectors/conversations.dom.js';
import { useChatFolderActions } from '../ducks/chatFolders.preload.js';
import { NavSidebarWidthBreakpointContext } from '../../components/NavSidebar.dom.js';
import { useNavActions } from '../ducks/nav.std.js';
import { NavTab, SettingsPage } from '../../types/Nav.std.js';
import { isChatFoldersEnabled } from '../../util/isChatFoldersEnabled.dom.js';
import type { ChatFolderId } from '../../types/ChatFolder.std.js';
import { getSelectedLocation } from '../selectors/nav.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';

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
            initChatFolderParams: null,
            previousLocation: location,
          },
        });
      },
      [changeLocation, location]
    );

    const version = window.SignalContext.getVersion();
    if (!isChatFoldersEnabled(version)) {
      return null;
    }

    return (
      <LeftPaneChatFolders
        i18n={i18n}
        navSidebarWidthBreakpoint={navSidebarWidthBreakpoint}
        currentChatFolders={currentChatFolders}
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
