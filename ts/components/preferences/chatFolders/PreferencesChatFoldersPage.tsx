// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { LocalizerType } from '../../../types/I18N';
import { PreferencesContent } from '../../Preferences';
import { SettingsRow } from '../../PreferencesUtil';
import type { ChatFolderId } from '../../../types/ChatFolder';
import {
  CHAT_FOLDER_PRESETS,
  matchesChatFolderPreset,
  type ChatFolderParams,
  type ChatFolderPreset,
  type ChatFolder,
  ChatFolderType,
} from '../../../types/ChatFolder';
import { Button, ButtonVariant } from '../../Button';
// import { showToast } from '../../state/ducks/toast';

export type PreferencesChatFoldersPageProps = Readonly<{
  i18n: LocalizerType;
  onBack: () => void;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
  chatFolders: ReadonlyArray<ChatFolder>;
  onCreateChatFolder: (params: ChatFolderParams) => void;
  settingsPaneRef: MutableRefObject<HTMLDivElement | null>;
}>;

export function PreferencesChatFoldersPage(
  props: PreferencesChatFoldersPageProps
): JSX.Element {
  const { i18n, onOpenEditChatFoldersPage, chatFolders } = props;

  // showToast(
  //   i18n("icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__AddButton__Toast")
  // )

  const handleOpenEditChatFoldersPageForNew = useCallback(() => {
    onOpenEditChatFoldersPage(null);
  }, [onOpenEditChatFoldersPage]);

  const presetItemsConfigs = useMemo(() => {
    const initial: ReadonlyArray<ChatFolderPresetItemConfig> = [
      {
        id: 'UnreadChats',
        title: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__UnreadFolder__Title'
        ),
        description: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__UnreadFolder__Description'
        ),
        preset: CHAT_FOLDER_PRESETS.UNREAD_CHATS,
      },
      {
        id: 'DirectChats',
        title: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__DirectChatsFolder__Title'
        ),
        description: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__DirectChatsFolder__Description'
        ),
        preset: CHAT_FOLDER_PRESETS.INDIVIDUAL_CHATS,
      },
      {
        id: 'GroupChats',
        title: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__GroupChatsFolder__Title'
        ),
        description: i18n(
          'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__GroupChatsFolder__Description'
        ),
        preset: CHAT_FOLDER_PRESETS.GROUP_CHATS,
      },
    ];

    const filtered = initial.filter(config => {
      return !chatFolders.some(chatFolder => {
        return matchesChatFolderPreset(chatFolder, config.preset);
      });
    });

    return filtered;
  }, [i18n, chatFolders]);

  return (
    <PreferencesContent
      backButton={
        <button
          type="button"
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={props.onBack}
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
            <ul data-testid="ChatFoldersList">
              <li>
                <button
                  type="button"
                  className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
                  onClick={handleOpenEditChatFoldersPageForNew}
                >
                  <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Add" />
                  <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                    {i18n(
                      'icu:Preferences__ChatFoldersPage__FoldersSection__CreateAFolderButton'
                    )}
                  </span>
                </button>
              </li>
              {props.chatFolders.map(chatFolder => {
                return (
                  <ChatFolderListItem
                    key={chatFolder.id}
                    i18n={i18n}
                    chatFolder={chatFolder}
                    onOpenEditChatFoldersPage={props.onOpenEditChatFoldersPage}
                  />
                );
              })}
            </ul>
          </SettingsRow>
          {presetItemsConfigs.length > 0 && (
            <SettingsRow
              title={i18n(
                'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__Title'
              )}
            >
              <ul
                data-testid="ChatFoldersPresets"
                className="Preferences__ChatFolders__ChatSelection__List"
              >
                {presetItemsConfigs.map(presetItemConfig => {
                  return (
                    <ChatFolderPresetItem
                      i18n={i18n}
                      config={presetItemConfig}
                      onCreateChatFolder={props.onCreateChatFolder}
                    />
                  );
                })}
              </ul>
            </SettingsRow>
          )}
        </>
      }
      contentsRef={props.settingsPaneRef}
      title={i18n('icu:Preferences__ChatFoldersPage__Title')}
    />
  );
}

type ChatFolderPresetItemConfig = Readonly<{
  id: 'UnreadChats' | 'DirectChats' | 'GroupChats';
  title: string;
  description: string;
  preset: ChatFolderPreset;
}>;

type ChatFolderPresetItemProps = Readonly<{
  i18n: LocalizerType;
  config: ChatFolderPresetItemConfig;
  onCreateChatFolder: (params: ChatFolderParams) => void;
}>;

function ChatFolderPresetItem(props: ChatFolderPresetItemProps) {
  const { i18n, config, onCreateChatFolder } = props;
  const { title, preset } = config;

  const handleCreateChatFolder = useCallback(() => {
    onCreateChatFolder({ ...preset, name: title });
  }, [onCreateChatFolder, title, preset]);

  return (
    <li
      data-testid={`ChatFolderPreset--${props.config.id}`}
      className="Preferences__ChatFolders__ChatSelection__Item"
    >
      <span
        className={`Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--${props.config.id}`}
      />
      <span className="Preferences__ChatFolders__ChatSelection__ItemBody">
        <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
          {props.config.title}
        </span>
        <span className="Preferences__ChatFolders__ChatSelection__ItemDescription">
          {props.config.description}
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
  i18n: LocalizerType;
  chatFolder: ChatFolder;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId) => void;
}): JSX.Element {
  const { i18n, chatFolder, onOpenEditChatFoldersPage } = props;

  const handleAction = useCallback(() => {
    onOpenEditChatFoldersPage(chatFolder.id);
  }, [chatFolder, onOpenEditChatFoldersPage]);

  return (
    <li>
      <button
        type="button"
        data-testid={`ChatFolder--${chatFolder.id}`}
        onClick={handleAction}
        className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
      >
        <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder" />
        <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
          {props.chatFolder.folderType === ChatFolderType.ALL &&
            i18n(
              'icu:Preferences__ChatFoldersPage__FoldersSection__AllChatsFolder__Title'
            )}
          {props.chatFolder.folderType === ChatFolderType.CUSTOM && (
            <>{props.chatFolder.name}</>
          )}
        </span>
      </button>
    </li>
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
