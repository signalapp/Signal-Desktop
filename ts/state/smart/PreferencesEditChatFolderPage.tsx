// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { PreferencesEditChatFolderPageProps } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage';
import { PreferencesEditChatFolderPage } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage';
import { getIntl, getTheme } from '../selectors/user';
import { CHAT_FOLDER_DEFAULTS } from '../../types/ChatFolder';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useChatFolderActions } from '../ducks/chatFolders';
import { getCurrentChatFolders } from '../selectors/chatFolders';
import { strictAssert } from '../../util/assert';

export type SmartPreferencesEditChatFolderPageProps = Readonly<{
  onBack: () => void;
  existingChatFolderId: PreferencesEditChatFolderPageProps['existingChatFolderId'];
  settingsPaneRef: PreferencesEditChatFolderPageProps['settingsPaneRef'];
}>;

export function SmartPreferencesEditChatFolderPage(
  props: SmartPreferencesEditChatFolderPageProps
): JSX.Element {
  const { existingChatFolderId } = props;

  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const conversations = useSelector(getAllComposableConversations);
  const conversationSelector = useSelector(getConversationSelector);
  const preferredBadgeSelector = useSelector(getPreferredBadgeSelector);
  const chatFolders = useSelector(getCurrentChatFolders);
  const { createChatFolder, updateChatFolder, deleteChatFolder } =
    useChatFolderActions();

  const initChatFolderParams = useMemo(() => {
    if (existingChatFolderId == null) {
      return CHAT_FOLDER_DEFAULTS;
    }
    const found = chatFolders.find(chatFolder => {
      return chatFolder.id === existingChatFolderId;
    });
    strictAssert(found, 'Unable to find chat folder');
    return found;
  }, [chatFolders, existingChatFolderId]);

  return (
    <PreferencesEditChatFolderPage
      i18n={i18n}
      existingChatFolderId={props.existingChatFolderId}
      initChatFolderParams={initChatFolderParams}
      onBack={props.onBack}
      conversations={conversations}
      preferredBadgeSelector={preferredBadgeSelector}
      theme={theme}
      settingsPaneRef={props.settingsPaneRef}
      conversationSelector={conversationSelector}
      onCreateChatFolder={createChatFolder}
      onUpdateChatFolder={updateChatFolder}
      onDeleteChatFolder={deleteChatFolder}
    />
  );
}
