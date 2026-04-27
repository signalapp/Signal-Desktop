// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { PreferencesEditChatFolderPageProps } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage.dom.tsx';
import { PreferencesEditChatFolderPage } from '../../components/preferences/chatFolders/PreferencesEditChatFoldersPage.dom.tsx';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import type { ChatFolderParams } from '../../types/ChatFolder.std.ts';
import { CHAT_FOLDER_DEFAULTS } from '../../types/ChatFolder.std.ts';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations.dom.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { useChatFolderActions } from '../ducks/chatFolders.preload.ts';
import { getCurrentChatFolders } from '../selectors/chatFolders.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import type { Location } from '../../types/Nav.std.ts';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.ts';

export type SmartPreferencesEditChatFolderPageProps = Readonly<{
  previousLocation: Location | null;
  existingChatFolderId: PreferencesEditChatFolderPageProps['existingChatFolderId'];
  initChatFolderParams: ChatFolderParams | null;
  settingsPaneRef: PreferencesEditChatFolderPageProps['settingsPaneRef'];
}>;

export function SmartPreferencesEditChatFolderPage(
  props: SmartPreferencesEditChatFolderPageProps
): React.JSX.Element {
  const { existingChatFolderId, initChatFolderParams } = props;

  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const conversations = useSelector(getAllComposableConversations);
  const conversationSelector = useSelector(getConversationSelector);
  const preferredBadgeSelector = useSelector(getPreferredBadgeSelector);
  const currentChatFolders = useSelector(getCurrentChatFolders);
  const { createChatFolder, updateChatFolder, deleteChatFolder } =
    useChatFolderActions();
  const { changeLocation } = useNavActions();

  const initChatFolderParamsOrCurrentChatFolder = useMemo(() => {
    if (existingChatFolderId == null) {
      return initChatFolderParams ?? CHAT_FOLDER_DEFAULTS;
    }
    return CurrentChatFolders.expect(
      currentChatFolders,
      existingChatFolderId,
      'initChatFolderParams'
    );
  }, [currentChatFolders, existingChatFolderId, initChatFolderParams]);

  return (
    <PreferencesEditChatFolderPage
      i18n={i18n}
      previousLocation={props.previousLocation}
      existingChatFolderId={props.existingChatFolderId}
      initChatFolderParams={initChatFolderParamsOrCurrentChatFolder}
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
