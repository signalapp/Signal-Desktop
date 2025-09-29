// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { ListBox, ListBoxItem, useDragAndDrop } from 'react-aria-components';
import { partition } from 'lodash';
import type { LocalizerType } from '../../../types/I18N.js';
import { PreferencesContent } from '../../Preferences.js';
import { SettingsRow } from '../../PreferencesUtil.js';
import {
  CHAT_FOLDER_PRESETS,
  matchesChatFolderPreset,
  ChatFolderType,
} from '../../../types/ChatFolder.js';
import type {
  ChatFolderId,
  ChatFolderParams,
  ChatFolderPreset,
  ChatFolder,
} from '../../../types/ChatFolder.js';
import { Button, ButtonVariant } from '../../Button.js';
import { AxoContextMenu } from '../../../axo/AxoContextMenu.js';
import { DeleteChatFolderDialog } from './DeleteChatFolderDialog.js';
import { strictAssert } from '../../../util/assert.js';
import { tw } from '../../../axo/tw.js';
// import { showToast } from '../../state/ducks/toast';

function moveChatFolders(
  chatFolders: ReadonlyArray<ChatFolder>,
  target: ChatFolderId,
  moving: Set<ChatFolderId>,
  position: 'before' | 'after'
) {
  const [toSplice, toInsert] = partition(chatFolders, chatFolder => {
    return !moving.has(chatFolder.id);
  });

  const targetIndex = toSplice.findIndex(chatFolder => {
    return chatFolder.id === target;
  });

  if (targetIndex === -1) {
    return chatFolders;
  }

  const spliceIndex = position === 'before' ? targetIndex : targetIndex + 1;

  return toSplice.toSpliced(spliceIndex, 0, ...toInsert);
}

export type PreferencesChatFoldersPageProps = Readonly<{
  i18n: LocalizerType;
  onBack: () => void;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
  chatFolders: ReadonlyArray<ChatFolder>;
  onCreateChatFolder: (params: ChatFolderParams) => void;
  onDeleteChatFolder: (chatFolderId: ChatFolderId) => void;
  onUpdateChatFoldersPositions: (
    chatFolderIds: ReadonlyArray<ChatFolderId>
  ) => void;
  settingsPaneRef: MutableRefObject<HTMLDivElement | null>;
}>;

export function PreferencesChatFoldersPage(
  props: PreferencesChatFoldersPageProps
): JSX.Element {
  const {
    i18n,
    onOpenEditChatFoldersPage,
    onDeleteChatFolder,
    onUpdateChatFoldersPositions,
    chatFolders,
  } = props;
  const [confirmDeleteChatFolder, setConfirmDeleteChatFolder] =
    useState<ChatFolder | null>(null);

  // showToast(
  //   i18n("icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__AddButton__Toast")
  // )

  const handleChatFolderCreate = useCallback(() => {
    onOpenEditChatFoldersPage(null);
  }, [onOpenEditChatFoldersPage]);

  const handleChatFolderEdit = useCallback(
    (chatFolder: ChatFolder) => {
      onOpenEditChatFoldersPage(chatFolder.id);
    },
    [onOpenEditChatFoldersPage]
  );

  const handleChatFolderDeleteInit = useCallback((chatFolder: ChatFolder) => {
    setConfirmDeleteChatFolder(chatFolder);
  }, []);

  const handleChatFolderDeleteCancel = useCallback(() => {
    setConfirmDeleteChatFolder(null);
  }, []);

  const handleChatFolderDeleteConfirm = useCallback(() => {
    strictAssert(confirmDeleteChatFolder, 'Missing chat folder to delete');
    onDeleteChatFolder(confirmDeleteChatFolder.id);
  }, [confirmDeleteChatFolder, onDeleteChatFolder]);

  const [chatFoldersReordered, setChatFoldersReordered] = useState(chatFolders);

  useEffect(() => {
    setChatFoldersReordered(chatFolders);
  }, [chatFolders]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: () => {
      return chatFolders.map(chatFolder => {
        return { 'signal-chat-folder-id': chatFolder.id.slice(-3) };
      });
    },
    acceptedDragTypes: ['signal-chat-folder-id'],
    getDropOperation: () => 'move',
    onDragEnd: () => {
      onUpdateChatFoldersPositions(
        chatFoldersReordered.map(chatFolder => {
          return chatFolder.id;
        })
      );
    },
    onReorder: event => {
      const target = event.target.key as ChatFolderId;
      const moving = event.keys as Set<ChatFolderId>;
      const position = event.target.dropPosition;

      if (position !== 'before' && position !== 'after') {
        return;
      }

      setChatFoldersReordered(prevChatFolders => {
        return moveChatFolders(prevChatFolders, target, moving, position);
      });
    },
    renderDropIndicator: () => {
      return <div className={tw('h-12')} />;
    },
  });

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
    <>
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
              className={tw('mt-4')}
            >
              <button
                type="button"
                className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
                onClick={handleChatFolderCreate}
              >
                <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Add" />
                <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                  {i18n(
                    'icu:Preferences__ChatFoldersPage__FoldersSection__CreateAFolderButton'
                  )}
                </span>
              </button>
              <ListBox
                selectionMode="single"
                data-testid="ChatFoldersList"
                items={chatFoldersReordered}
                dragAndDropHooks={dragAndDropHooks}
              >
                {chatFolder => {
                  return (
                    <ChatFolderListItem
                      i18n={i18n}
                      chatFolder={chatFolder}
                      onChatFolderEdit={handleChatFolderEdit}
                      onChatFolderDelete={handleChatFolderDeleteInit}
                    />
                  );
                }}
              </ListBox>
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
                        key={presetItemConfig.id}
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
      {confirmDeleteChatFolder != null && (
        <DeleteChatFolderDialog
          i18n={i18n}
          title={i18n(
            'icu:Preferences__ChatsPage__DeleteChatFolderDialog__Title'
          )}
          description={i18n(
            'icu:Preferences__ChatsPage__DeleteChatFolderDialog__Description',
            { chatFolderTitle: confirmDeleteChatFolder.name }
          )}
          deleteText={i18n(
            'icu:Preferences__ChatsPage__DeleteChatFolderDialog__DeleteButton'
          )}
          cancelText={i18n(
            'icu:Preferences__ChatsPage__DeleteChatFolderDialog__CancelButton'
          )}
          onClose={handleChatFolderDeleteCancel}
          onConfirm={handleChatFolderDeleteConfirm}
        />
      )}
    </>
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
  onChatFolderEdit: (chatFolder: ChatFolder) => void;
  onChatFolderDelete: (chatFolder: ChatFolder) => void;
}): JSX.Element {
  const { i18n, chatFolder, onChatFolderEdit } = props;

  const handleClickChatFolder = useCallback(() => {
    onChatFolderEdit(chatFolder);
  }, [chatFolder, onChatFolderEdit]);

  return (
    <>
      {props.chatFolder.folderType === ChatFolderType.ALL && (
        <ListBoxItem
          id={chatFolder.id}
          data-testid={`ChatFolder--${chatFolder.id}`}
          className="Preferences__ChatFolders__ChatSelection__Item"
        >
          <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder" />
          {i18n(
            'icu:Preferences__ChatFoldersPage__FoldersSection__AllChatsFolder__Title'
          )}
        </ListBoxItem>
      )}

      {props.chatFolder.folderType === ChatFolderType.CUSTOM && (
        <ListBoxItem
          id={chatFolder.id}
          data-testid={`ChatFolder--${chatFolder.id}`}
          textValue={props.chatFolder.name}
          onAction={handleClickChatFolder}
        >
          <ChatFolderListItemContextMenu
            i18n={i18n}
            chatFolder={props.chatFolder}
            onChatFolderEdit={props.onChatFolderEdit}
            onChatFolderDelete={props.onChatFolderDelete}
          >
            <div className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button">
              <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Folder" />
              {props.chatFolder.name}
            </div>
          </ChatFolderListItemContextMenu>
        </ListBoxItem>
      )}
    </>
  );
}

function ChatFolderListItemContextMenu(props: {
  i18n: LocalizerType;
  chatFolder: ChatFolder;
  onChatFolderEdit: (chatFolder: ChatFolder) => void;
  onChatFolderDelete: (chatFolder: ChatFolder) => void;
  children: ReactNode;
}) {
  const { i18n, chatFolder, onChatFolderEdit, onChatFolderDelete } = props;

  const handleSelectChatFolderEdit = useCallback(() => {
    onChatFolderEdit(chatFolder);
  }, [chatFolder, onChatFolderEdit]);

  const handleSelectChatFolderDelete = useCallback(() => {
    onChatFolderDelete(chatFolder);
  }, [chatFolder, onChatFolderDelete]);

  if (chatFolder.folderType !== ChatFolderType.CUSTOM) {
    return <>{props.children}</>;
  }

  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        <AxoContextMenu.Item
          symbol="pencil"
          onSelect={handleSelectChatFolderEdit}
        >
          {i18n(
            'icu:Preferences__ChatsPage__ChatFoldersSection__ChatFolderItem__ContextMenu__EditFolder'
          )}
        </AxoContextMenu.Item>
        <AxoContextMenu.Item
          symbol="trash"
          onSelect={handleSelectChatFolderDelete}
        >
          {i18n(
            'icu:Preferences__ChatsPage__ChatFoldersSection__ChatFolderItem__ContextMenu__DeleteFolder'
          )}
        </AxoContextMenu.Item>
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}
