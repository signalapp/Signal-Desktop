// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { useSelector } from 'react-redux';
import type { PreferencesChatFoldersPageProps } from '../../components/preferences/chatFolders/PreferencesChatFoldersPage.js';
import { PreferencesChatFoldersPage } from '../../components/preferences/chatFolders/PreferencesChatFoldersPage.js';
import { getIntl } from '../selectors/user.js';
import { getCurrentChatFolders } from '../selectors/chatFolders.js';
import type { ChatFolderId } from '../../types/ChatFolder.js';
import { useChatFolderActions } from '../ducks/chatFolders.js';
import type { Location } from '../../types/Nav.js';
import { useNavActions } from '../ducks/nav.js';

export type SmartPreferencesChatFoldersPageProps = Readonly<{
  settingsPaneRef: PreferencesChatFoldersPageProps['settingsPaneRef'];
  previousLocation: Location | null;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
}>;

export function SmartPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): JSX.Element {
  const i18n = useSelector(getIntl);
  const currentChatFolders = useSelector(getCurrentChatFolders);
  const { createChatFolder, deleteChatFolder, updateChatFoldersPositions } =
    useChatFolderActions();
  const { changeLocation } = useNavActions();
  return (
    <PreferencesChatFoldersPage
      i18n={i18n}
      settingsPaneRef={props.settingsPaneRef}
      previousLocation={props.previousLocation}
      onOpenEditChatFoldersPage={props.onOpenEditChatFoldersPage}
      changeLocation={changeLocation}
      currentChatFolders={currentChatFolders}
      onCreateChatFolder={createChatFolder}
      onDeleteChatFolder={deleteChatFolder}
      onUpdateChatFoldersPositions={updateChatFoldersPositions}
    />
  );
}
