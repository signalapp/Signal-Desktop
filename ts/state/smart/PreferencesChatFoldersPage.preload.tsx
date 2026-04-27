// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { useSelector } from 'react-redux';
import type { PreferencesChatFoldersPageProps } from '../../components/preferences/chatFolders/PreferencesChatFoldersPage.dom.tsx';
import { PreferencesChatFoldersPage } from '../../components/preferences/chatFolders/PreferencesChatFoldersPage.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { getCurrentChatFolders } from '../selectors/chatFolders.std.ts';
import type { ChatFolderId } from '../../types/ChatFolder.std.ts';
import { useChatFolderActions } from '../ducks/chatFolders.preload.ts';
import type { Location } from '../../types/Nav.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';

export type SmartPreferencesChatFoldersPageProps = Readonly<{
  settingsPaneRef: PreferencesChatFoldersPageProps['settingsPaneRef'];
  previousLocation: Location | null;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
}>;

export function SmartPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): React.JSX.Element {
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
