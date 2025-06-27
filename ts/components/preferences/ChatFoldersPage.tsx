// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import type { LocalizerType } from '../../types/I18N';
import { PreferencesContent } from '../Preferences';
import { SettingsRow } from '../PreferencesUtil';
import type { ChatFolderId } from '../../types/ChatFolder';
import {
  CHAT_FOLDER_PRESETS,
  matchesChatFolderPreset,
  type ChatFolderParams,
  type ChatFolderPreset,
  type ChatFolderRecord,
} from '../../types/ChatFolder';
import { Button, ButtonVariant } from '../Button';
// import { showToast } from '../../state/ducks/toast';

export type ChatFoldersPageProps = Readonly<{
  i18n: LocalizerType;
  onBack: () => void;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
  chatFolders: ReadonlyArray<ChatFolderRecord>;
  onCreateChatFolder: (params: ChatFolderParams) => void;
  settingsPaneRef: MutableRefObject<HTMLDivElement | null>;
}>;

export function ChatFoldersPage(props: ChatFoldersPageProps): JSX.Element {
  const { i18n, onOpenEditChatFoldersPage } = props;

  // showToast(
  //   i18n("icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__AddButton__Toast")
  // )

  const handleOpenEditChatFoldersPageForNew = useCallback(() => {
    onOpenEditChatFoldersPage(null);
  }, [onOpenEditChatFoldersPage]);

  return (
    <PreferencesContent
      backButton={
        <button
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={props.onBack}
          type="button"
        />
      }
      contents={
        <>
          <p className="Preferences__description Preferences__padding">
            {i18n('icu:Preferences__ChatFoldersPage__Description')}
          </p>
          <SettingsRow
            title={i18n(
              'icu:Preferences__ChatFoldersPage__FoldersSection__Title'
            )}
          >
            <ListBox>
              <ListBoxItem
                className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
                onAction={handleOpenEditChatFoldersPageForNew}
              >
                <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Add" />
                <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                  {i18n(
                    'icu:Preferences__ChatFoldersPage__FoldersSection__CreateAFolderButton'
                  )}
                </span>
              </ListBoxItem>
              <ListBoxItem className="Preferences__ChatFolders__ChatSelection__Item">
                <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder" />
                <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                  {i18n(
                    'icu:Preferences__ChatFoldersPage__FoldersSection__AllChatsFolder__Title'
                  )}
                </span>
              </ListBoxItem>
              {props.chatFolders.map(chatFolder => {
                return (
                  <ChatFolderListItem
                    key={chatFolder.id}
                    chatFolder={chatFolder}
                    onOpenEditChatFoldersPage={props.onOpenEditChatFoldersPage}
                  />
                );
              })}
            </ListBox>
          </SettingsRow>
          <SettingsRow
            title={i18n(
              'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__Title'
            )}
          >
            <ul className="Preferences__ChatFolders__ChatSelection__List">
              <ChatFolderPresetItem
                i18n={i18n}
                icon="UnreadChats"
                title={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__UnreadFolder__Title'
                )}
                description={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__UnreadFolder__Description'
                )}
                preset={CHAT_FOLDER_PRESETS.UNREAD_CHATS}
                chatFolders={props.chatFolders}
                onCreateChatFolder={props.onCreateChatFolder}
              />

              <ChatFolderPresetItem
                i18n={i18n}
                icon="DirectChats"
                title={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__DirectChatsFolder__Title'
                )}
                description={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__DirectChatsFolder__Description'
                )}
                preset={CHAT_FOLDER_PRESETS.INDIVIDUAL_CHATS}
                chatFolders={props.chatFolders}
                onCreateChatFolder={props.onCreateChatFolder}
              />

              <ChatFolderPresetItem
                i18n={i18n}
                icon="GroupChats"
                title={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__GroupChatsFolder__Title'
                )}
                description={i18n(
                  'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__GroupChatsFolder__Description'
                )}
                preset={CHAT_FOLDER_PRESETS.GROUP_CHATS}
                chatFolders={props.chatFolders}
                onCreateChatFolder={props.onCreateChatFolder}
              />
            </ul>
          </SettingsRow>
        </>
      }
      contentsRef={props.settingsPaneRef}
      title={i18n('icu:Preferences__ChatFoldersPage__Title')}
    />
  );
}

function ChatFolderPresetItem(props: {
  i18n: LocalizerType;
  icon: 'UnreadChats' | 'DirectChats' | 'GroupChats';
  title: string;
  description: string;
  preset: ChatFolderPreset;
  chatFolders: ReadonlyArray<ChatFolderRecord>;
  onCreateChatFolder: (params: ChatFolderParams) => void;
}) {
  const { i18n, title, preset, chatFolders, onCreateChatFolder } = props;

  const handleCreateChatFolder = useCallback(() => {
    onCreateChatFolder({ ...preset, name: title });
  }, [onCreateChatFolder, title, preset]);

  const hasPreset = useMemo(() => {
    return chatFolders.some(chatFolder => {
      return matchesChatFolderPreset(chatFolder, preset);
    });
  }, [chatFolders, preset]);

  if (hasPreset) {
    return null;
  }

  return (
    <li className="Preferences__ChatFolders__ChatSelection__Item">
      <span
        className={`Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--${props.icon}`}
      />
      <span className="Preferences__ChatFolders__ChatSelection__ItemBody">
        <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
          {props.title}
        </span>
        <span className="Preferences__ChatFolders__ChatSelection__ItemDescription">
          {props.description}
        </span>
      </span>
      <Button
        variant={ButtonVariant.Secondary}
        onClick={handleCreateChatFolder}
      >
        {i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__AddButton'
        )}
      </Button>
    </li>
  );
}

function ChatFolderListItem(props: {
  chatFolder: ChatFolderRecord;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId) => void;
}): JSX.Element {
  const { chatFolder, onOpenEditChatFoldersPage } = props;
  const handleAction = useCallback(() => {
    onOpenEditChatFoldersPage(chatFolder.id);
  }, [chatFolder, onOpenEditChatFoldersPage]);
  return (
    <ListBoxItem
      className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
      onAction={handleAction}
    >
      <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder" />
      <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
        {props.chatFolder.name}
      </span>
    </ListBoxItem>
  );
}

// function ChatFolderContextMenu(props: {
//   i18n: LocalizerType;
//   children: ReactNode;
// }) {
//   const { i18n } = props;
//   return (
//     <AxoContextMenu.Root>
//       <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
//       <AxoContextMenu.Content>
//         <AxoContextMenu.Item>
//           {i18n(
// eslint-disable-next-line max-len
//             'icu:Preferences__ChatsPage__ChatFoldersSection__ChatFolderItem__ContextMenu__EditFolder'
//           )}
//         </AxoContextMenu.Item>
//         <AxoContextMenu.Item>
//           {i18n(
// eslint-disable-next-line max-len
//             'icu:Preferences__ChatsPage__ChatFoldersSection__ChatFolderItem__ContextMenu__DeleteFolder'
//           )}
//         </AxoContextMenu.Item>
//       </AxoContextMenu.Content>
//     </AxoContextMenu.Root>
//   );
// }

// function DeleteChatFolderDialog(props: { i18n: LocalizerType }): JSX.Element {
//   const { i18n } = props;
//   return (
//     <ConfirmationDialog
//       i18n={i18n}
//       dialogName="Preferences__ChatsPage__DeleteChatFolderDialog"
//       title={i18n('icu:Preferences__ChatsPage__DeleteChatFolderDialog__Title')}
//       cancelText={i18n(
//         'icu:Preferences__ChatsPage__DeleteChatFolderDialog__CancelButton'
//       )}
//       actions={[
//         {
//           text: i18n(
//             'icu:Preferences__ChatsPage__DeleteChatFolderDialog__DeleteButton'
//           ),
//           style: 'affirmative',
//           action: () => null,
//         },
//       ]}
//       onClose={() => null}
//     >
//       {i18n('icu:Preferences__ChatsPage__DeleteChatFolderDialog__Description', {
//         chatFolderTitle: '',
//       })}
//     </ConfirmationDialog>
//   );
// }
