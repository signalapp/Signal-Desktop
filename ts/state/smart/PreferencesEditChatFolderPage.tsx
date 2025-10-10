// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { PreferencesEditChatFolderPageProps } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage.js';
import { PreferencesEditChatFolderPage } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage.js';
import { getIntl, getTheme } from '../selectors/user.js';
import { CHAT_FOLDER_DEFAULTS } from '../../types/ChatFolder.js';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { useChatFolderActions } from '../ducks/chatFolders.js';
import { getCurrentChatFolders } from '../selectors/chatFolders.js';
import { useNavActions } from '../ducks/nav.js';
import type { Location } from '../../types/Nav.js';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.js';

export type SmartPreferencesEditChatFolderPageProps = Readonly<{
  previousLocation: Location | null;
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
  const currentChatFolders = useSelector(getCurrentChatFolders);
  const { createChatFolder, updateChatFolder, deleteChatFolder } =
    useChatFolderActions();
  const { changeLocation } = useNavActions();

  const initChatFolderParams = useMemo(() => {
    if (existingChatFolderId == null) {
      return CHAT_FOLDER_DEFAULTS;
    }
    return CurrentChatFolders.expect(
      currentChatFolders,
      existingChatFolderId,
      'initChatFolderParams'
    );
  }, [currentChatFolders, existingChatFolderId]);

  return (
    <PreferencesEditChatFolderPage
      i18n={i18n}
      previousLocation={props.previousLocation}
      existingChatFolderId={props.existingChatFolderId}
      initChatFolderParams={initChatFolderParams}
      changeLocation={changeLocation}
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
