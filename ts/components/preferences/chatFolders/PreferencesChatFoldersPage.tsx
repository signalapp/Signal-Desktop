// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { ListBox, ListBoxItem, useDragAndDrop } from 'react-aria-components';
import { isEqual, partition } from 'lodash';
import classNames from 'classnames';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { PreferencesContent } from '../../Preferences.dom.js';
import { SettingsRow } from '../../PreferencesUtil.dom.js';
import {
  CHAT_FOLDER_PRESETS,
  matchesChatFolderPreset,
  ChatFolderType,
} from '../../../types/ChatFolder.std.js';
import type {
  ChatFolderId,
  ChatFolderParams,
  ChatFolderPreset,
  ChatFolder,
} from '../../../types/ChatFolder.std.js';
import { AxoContextMenu } from '../../../axo/AxoContextMenu.dom.js';
import { DeleteChatFolderDialog } from './DeleteChatFolderDialog.dom.js';
import { strictAssert } from '../../../util/assert.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { UserText } from '../../UserText.dom.js';
import { I18n } from '../../I18n.dom.js';
import { NavTab, SettingsPage, type Location } from '../../../types/Nav.std.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';
import type { CurrentChatFolder } from '../../../types/CurrentChatFolders.std.js';
import { CurrentChatFolders } from '../../../types/CurrentChatFolders.std.js';
import {
  ItemAvatar,
  ItemBody,
  itemButtonClassName,
  itemClassName,
  itemClickableClassName,
  ItemContent,
  ItemDescription,
  ItemDragHandle,
  itemListItemClassName,
  ItemTitle,
} from './PreferencesChatFolderItems.dom.js';

function moveChatFolders(
  chatFolders: ReadonlyArray<CurrentChatFolder>,
  target: ChatFolderId,
  moving: Set<ChatFolderId>,
  position: 'before' | 'after'
): ReadonlyArray<CurrentChatFolder> {
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

function hasChatFoldersOrderChanged(
  sortedChatFolders: ReadonlyArray<ChatFolder>,
  chatFoldersReordered: ReadonlyArray<ChatFolder>
): boolean {
  const a = sortedChatFolders.map(chatFolder => chatFolder.id);
  const b = chatFoldersReordered.map(chatFolder => chatFolder.id);
  return !isEqual(a, b);
}

export type PreferencesChatFoldersPageProps = Readonly<{
  i18n: LocalizerType;
  onOpenEditChatFoldersPage: (chatFolderId: ChatFolderId | null) => void;
  changeLocation: (location: Location) => void;
  currentChatFolders: CurrentChatFolders;
  onCreateChatFolder: (
    params: ChatFolderParams,
    showToastOnSuccess: boolean
  ) => void;
  onDeleteChatFolder: (chatFolderId: ChatFolderId) => void;
  onUpdateChatFoldersPositions: (
    chatFolderIds: ReadonlyArray<ChatFolderId>
  ) => void;
  previousLocation: Location | null;
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
    previousLocation,
    changeLocation,
    currentChatFolders,
  } = props;
  const [confirmDeleteChatFolder, setConfirmDeleteChatFolder] =
    useState<ChatFolder | null>(null);

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

  const handleBack = useCallback(() => {
    changeLocation(
      previousLocation ?? {
        tab: NavTab.Settings,
        details: {
          page: SettingsPage.Chats,
        },
      }
    );
  }, [changeLocation, previousLocation]);

  const sortedChatFolders = useMemo(() => {
    return CurrentChatFolders.toSortedArray(currentChatFolders);
  }, [currentChatFolders]);

  const [chatFoldersReordered, setChatFoldersReordered] =
    useState(sortedChatFolders);

  useEffect(() => {
    setChatFoldersReordered(sortedChatFolders);
  }, [sortedChatFolders]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: () => {
      return sortedChatFolders.map(chatFolder => {
        return { 'signal-chat-folder-id': chatFolder.id.slice(-3) };
      });
    },
    getAllowedDropOperations() {
      return ['move'];
    },
    acceptedDragTypes: ['signal-chat-folder-id'],
    getDropOperation: () => 'move',
    onDragEnd: () => {
      if (
        !hasChatFoldersOrderChanged(sortedChatFolders, chatFoldersReordered)
      ) {
        return;
      }

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
      return (
        <div className={tw('-my-px h-0.5 rounded-full bg-fill-inverted')} />
      );
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
      return !sortedChatFolders.some(chatFolder => {
        return matchesChatFolderPreset(chatFolder, config.preset);
      });
    });

    return filtered;
  }, [i18n, sortedChatFolders]);

  return (
    <>
      <PreferencesContent
        backButton={
          <button
            type="button"
            aria-label={i18n('icu:goBack')}
            className="Preferences__back-icon"
            onClick={handleBack}
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
                className={classNames(itemClassName, itemButtonClassName)}
                onClick={handleChatFolderCreate}
              >
                <ItemContent>
                  <ItemAvatar kind="Add" />
                  <ItemTitle>
                    {i18n(
                      'icu:Preferences__ChatFoldersPage__FoldersSection__CreateAFolderButton'
                    )}
                  </ItemTitle>
                </ItemContent>
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
          description={
            <I18n
              i18n={i18n}
              id="icu:Preferences__ChatsPage__DeleteChatFolderDialog__Description"
              components={{
                chatFolderTitle: (
                  <UserText text={confirmDeleteChatFolder.name} />
                ),
              }}
            />
          }
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

export type ChatFolderPresetId = 'UnreadChats' | 'DirectChats' | 'GroupChats';

type ChatFolderPresetItemConfig = Readonly<{
  id: ChatFolderPresetId;
  title: string;
  description: string;
  preset: ChatFolderPreset;
}>;

type ChatFolderPresetItemProps = Readonly<{
  i18n: LocalizerType;
  config: ChatFolderPresetItemConfig;
  onCreateChatFolder: (
    params: ChatFolderParams,
    showToastOnSuccess: boolean
  ) => void;
}>;

function ChatFolderPresetItem(props: ChatFolderPresetItemProps) {
  const { i18n, config, onCreateChatFolder } = props;
  const { title, preset } = config;

  const handleCreateChatFolder = useCallback(() => {
    onCreateChatFolder({ ...preset, name: title }, true);
  }, [onCreateChatFolder, title, preset]);

  return (
    <li
      data-testid={`ChatFolderPreset--${props.config.id}`}
      className={itemClassName}
    >
      <ItemContent>
        <ItemAvatar kind={props.config.id} />
        <ItemBody>
          <ItemTitle>{props.config.title}</ItemTitle>
          <ItemDescription>{props.config.description}</ItemDescription>
        </ItemBody>
        <AxoButton.Root
          size="medium"
          variant="secondary"
          onClick={handleCreateChatFolder}
        >
          {i18n(
            'icu:Preferences__ChatFoldersPage__SuggestedFoldersSection__AddButton'
          )}
        </AxoButton.Root>
      </ItemContent>
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
          className={classNames(itemClassName, itemListItemClassName)}
        >
          <ItemContent>
            <ItemAvatar kind="Folder" />
            <ItemBody>
              <ItemTitle>
                {i18n(
                  'icu:Preferences__ChatFoldersPage__FoldersSection__AllChatsFolder__Title'
                )}
              </ItemTitle>
            </ItemBody>
            <ItemDragHandle i18n={i18n} />
          </ItemContent>
        </ListBoxItem>
      )}

      {props.chatFolder.folderType === ChatFolderType.CUSTOM && (
        <ListBoxItem
          id={chatFolder.id}
          data-testid={`ChatFolder--${chatFolder.id}`}
          textValue={props.chatFolder.name}
          onAction={handleClickChatFolder}
          className={classNames(
            itemClassName,
            itemListItemClassName,
            itemClickableClassName
          )}
        >
          <ChatFolderListItemContextMenu
            i18n={i18n}
            chatFolder={props.chatFolder}
            onChatFolderEdit={props.onChatFolderEdit}
            onChatFolderDelete={props.onChatFolderDelete}
          >
            <ItemContent>
              <ItemAvatar kind="Folder" />
              <ItemBody>
                <ItemTitle>
                  <UserText text={props.chatFolder.name} />
                </ItemTitle>
              </ItemBody>
              <ItemDragHandle i18n={i18n} />
            </ItemContent>
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
