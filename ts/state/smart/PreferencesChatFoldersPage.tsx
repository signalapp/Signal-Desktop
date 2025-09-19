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

export type SmartPreferencesChatFoldersPageProps = Readonly<{
  settingsPaneRef: PreferencesChatFoldersPageProps['settingsPaneRef'];
  onBack: () => void;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
}>;

export function SmartPreferencesChatFoldersPage(
  props: SmartPreferencesChatFoldersPageProps
): JSX.Element {
  const i18n = useSelector(getIntl);
  const chatFolders = useSelector(getCurrentChatFolders);
  const { createChatFolder } = useChatFolderActions();
  return (
    <PreferencesChatFoldersPage
      i18n={i18n}
      settingsPaneRef={props.settingsPaneRef}
      onBack={props.onBack}
      onOpenEditChatFoldersPage={props.onOpenEditChatFoldersPage}
      chatFolders={chatFolders}
      onCreateChatFolder={createChatFolder}
    />
  );
}
