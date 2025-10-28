// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  useCallback,
  useMemo,
  type FocusEvent,
  type ReactNode,
} from 'react';
import {
  ChatFolderType,
  type ChatFolder,
  type ChatFolderId,
} from '../../types/ChatFolder.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { ExperimentalAxoSegmentedControl } from '../../axo/AxoSegmentedControl.dom.js';
import { tw } from '../../axo/tw.dom.js';
import type {
  AllChatFoldersUnreadStats,
  UnreadStats,
} from '../../util/countUnreadStats.std.js';
import { WidthBreakpoint } from '../_util.std.js';
import { AxoSelect } from '../../axo/AxoSelect.dom.js';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.js';
import { getMuteValuesOptions } from '../../util/getMuteOptions.std.js';
import type {
  AllChatFoldersMutedStats,
  MutedStats,
} from '../../util/countMutedStats.std.js';
import type { AxoSymbol } from '../../axo/AxoSymbol.dom.js';
import { UserText } from '../UserText.dom.js';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.js';

export type LeftPaneChatFoldersProps = Readonly<{
  i18n: LocalizerType;
  navSidebarWidthBreakpoint: WidthBreakpoint | null;
  currentChatFolders: CurrentChatFolders;
  allChatFoldersUnreadStats: AllChatFoldersUnreadStats;
  allChatFoldersMutedStats: AllChatFoldersMutedStats;
  selectedChatFolder: ChatFolder | null;
  onSelectedChatFolderIdChange: (newValue: ChatFolderId) => void;
  onChatFolderMarkRead: (chatFolderId: ChatFolderId) => void;
  onChatFolderUpdateMute: (chatFolderId: ChatFolderId, value: number) => void;
  onChatFolderOpenSettings: (chatFolderId: ChatFolderId) => void;
}>;

function getBadgeValue(
  unreadStats: UnreadStats | null
): ExperimentalAxoSegmentedControl.ExperimentalItemBadgeProps['value'] | null {
  if (unreadStats == null) {
    return null;
  }
  if (unreadStats.unreadCount > 0) {
    return unreadStats.unreadCount + unreadStats.readChatsMarkedUnreadCount;
  }
  if (unreadStats.readChatsMarkedUnreadCount > 0) {
    return unreadStats.readChatsMarkedUnreadCount;
  }
  return null;
}

function getChatFolderLabel(
  i18n: LocalizerType,
  chatFolder: ChatFolder,
  preferShort: boolean
): ReactNode {
  if (chatFolder.folderType === ChatFolderType.ALL) {
    if (preferShort) {
      return i18n('icu:LeftPaneChatFolders__ItemLabel--All--Short');
    }
    return i18n('icu:LeftPaneChatFolders__ItemLabel--All');
  }
  if (chatFolder.folderType === ChatFolderType.CUSTOM) {
    return <UserText text={chatFolder.name} />;
  }
  return '';
}

function getChatFolderIconName(
  chatFolder: ChatFolder | null
): AxoSymbol.IconName {
  if (chatFolder == null) {
    return 'message';
  }

  return chatFolder.folderType === ChatFolderType.ALL ? 'message' : 'folder';
}

export function LeftPaneChatFolders(
  props: LeftPaneChatFoldersProps
): JSX.Element | null {
  const { i18n, currentChatFolders, onSelectedChatFolderIdChange } = props;

  const sortedChatFolders = useMemo(() => {
    return CurrentChatFolders.toSortedArray(currentChatFolders);
  }, [currentChatFolders]);

  const handleValueChange = useCallback(
    (newValue: string | null) => {
      if (newValue != null) {
        onSelectedChatFolderIdChange(newValue as ChatFolderId);
      }
    },
    [onSelectedChatFolderIdChange]
  );

  const handleFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    event.target.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
    });
  }, []);

  if (!currentChatFolders.hasAnyCurrentCustomChatFolders) {
    return null;
  }

  if (props.navSidebarWidthBreakpoint === WidthBreakpoint.Narrow) {
    return (
      <div className={tw('px-2')}>
        <AxoSelect.Root
          value={props.selectedChatFolder?.id ?? null}
          onValueChange={handleValueChange}
        >
          <AxoSelect.Trigger
            variant="floating"
            width="full"
            placeholder=""
            chevron="on-hover"
          />
          <AxoSelect.Content position="dropdown">
            {sortedChatFolders.map(chatFolder => {
              const unreadStats =
                props.allChatFoldersUnreadStats.get(chatFolder.id) ?? null;
              return (
                <ChatFolderSelectItem
                  key={chatFolder.id}
                  i18n={i18n}
                  chatFolder={chatFolder}
                  unreadStats={unreadStats}
                />
              );
            })}
          </AxoSelect.Content>
        </AxoSelect.Root>
      </div>
    );
  }

  return (
    <div
      className={tw(
        'scroll-px-[20%] overflow-x-auto overflow-y-clip px-4 py-2 [scrollbar-width:none]'
      )}
      onFocus={handleFocus}
    >
      <ExperimentalAxoSegmentedControl.Root
        variant="no-track"
        width="full"
        itemWidth="fit"
        value={props.selectedChatFolder?.id ?? null}
        onValueChange={handleValueChange}
      >
        {sortedChatFolders.map(chatFolder => {
          const unreadStats =
            props.allChatFoldersUnreadStats.get(chatFolder.id) ?? null;
          const mutedStats =
            props.allChatFoldersMutedStats.get(chatFolder.id) ?? null;
          return (
            <ChatFolderSegmentedControlItem
              key={chatFolder.id}
              i18n={i18n}
              chatFolder={chatFolder}
              unreadStats={unreadStats}
              mutedStats={mutedStats}
              onChatFolderMarkRead={props.onChatFolderMarkRead}
              onChatFolderUpdateMute={props.onChatFolderUpdateMute}
              onChatFolderOpenSettings={props.onChatFolderOpenSettings}
            />
          );
        })}
      </ExperimentalAxoSegmentedControl.Root>
    </div>
  );
}

const UNREAD_BADGE_MAX_COUNT = 999;

function ChatFolderSelectItem(props: {
  i18n: LocalizerType;
  chatFolder: ChatFolder;
  unreadStats: UnreadStats | null;
}): JSX.Element {
  const { i18n, unreadStats } = props;

  const badgeValue = useMemo(() => {
    return getBadgeValue(unreadStats);
  }, [unreadStats]);

  return (
    <AxoSelect.Item
      key={props.chatFolder.id}
      value={props.chatFolder.id}
      symbol={getChatFolderIconName(props.chatFolder)}
    >
      <AxoSelect.ItemText>
        {getChatFolderLabel(i18n, props.chatFolder, true)}
      </AxoSelect.ItemText>
      {badgeValue != null && (
        <AxoSelect.ExperimentalItemBadge
          value={badgeValue}
          max={UNREAD_BADGE_MAX_COUNT}
          maxDisplay={i18n(
            'icu:LeftPaneChatFolders__ItemUnreadBadge__MaxCount',
            {
              maxCount: UNREAD_BADGE_MAX_COUNT,
            }
          )}
          aria-label={null}
        />
      )}
    </AxoSelect.Item>
  );
}

function ChatFolderSegmentedControlItem(props: {
  i18n: LocalizerType;
  chatFolder: ChatFolder;
  unreadStats: UnreadStats | null;
  mutedStats: MutedStats | null;
  onChatFolderMarkRead: (chatFolderId: ChatFolderId) => void;
  onChatFolderUpdateMute: (chatFolderId: ChatFolderId, value: number) => void;
  onChatFolderOpenSettings: (chatFolderId: ChatFolderId) => void;
}): JSX.Element {
  const { i18n, unreadStats } = props;

  const badgeValue = useMemo(() => {
    return getBadgeValue(unreadStats);
  }, [unreadStats]);

  return (
    <ChatFolderSegmentedControlItemContextMenu
      i18n={i18n}
      chatFolder={props.chatFolder}
      unreadStats={props.unreadStats}
      mutedStats={props.mutedStats}
      onChatFolderMarkRead={props.onChatFolderMarkRead}
      onChatFolderUpdateMute={props.onChatFolderUpdateMute}
      onChatFolderOpenSettings={props.onChatFolderOpenSettings}
    >
      <ExperimentalAxoSegmentedControl.Item value={props.chatFolder.id}>
        <ExperimentalAxoSegmentedControl.ItemText maxWidth="12ch">
          {getChatFolderLabel(i18n, props.chatFolder, false)}
        </ExperimentalAxoSegmentedControl.ItemText>
        {badgeValue != null && (
          <ExperimentalAxoSegmentedControl.ExperimentalItemBadge
            value={badgeValue}
            max={UNREAD_BADGE_MAX_COUNT}
            maxDisplay={i18n(
              'icu:LeftPaneChatFolders__ItemUnreadBadge__MaxCount',
              { maxCount: UNREAD_BADGE_MAX_COUNT }
            )}
            aria-label={null}
          />
        )}
      </ExperimentalAxoSegmentedControl.Item>
    </ChatFolderSegmentedControlItemContextMenu>
  );
}

function ChatFolderSegmentedControlItemContextMenu(props: {
  i18n: LocalizerType;
  chatFolder: ChatFolder;
  unreadStats: UnreadStats | null;
  mutedStats: MutedStats | null;
  onChatFolderMarkRead: (chatFolderId: ChatFolderId) => void;
  onChatFolderUpdateMute: (chatFolderId: ChatFolderId, value: number) => void;
  onChatFolderOpenSettings: (chatFolderId: ChatFolderId) => void;
  children: ReactNode;
}) {
  const {
    i18n,
    onChatFolderMarkRead,
    onChatFolderUpdateMute,
    onChatFolderOpenSettings,
  } = props;
  const chatFolderId = props.chatFolder.id;

  const muteValuesOptions = useMemo(() => {
    return getMuteValuesOptions(i18n);
  }, [i18n]);

  const someChatsUnread =
    (props.unreadStats?.unreadCount ?? 0) > 0 ||
    (props.unreadStats?.readChatsMarkedUnreadCount ?? 0) > 0;
  const someChatsMuted = (props.mutedStats?.chatsMutedCount ?? 0) > 0;
  const someChatsUnmuted = (props.mutedStats?.chatsUnmutedCount ?? 0) > 0;

  const showOnlyUnmuteAll = someChatsMuted && !someChatsUnmuted;

  const handleChatFolderMarkRead = useCallback(() => {
    onChatFolderMarkRead(chatFolderId);
  }, [chatFolderId, onChatFolderMarkRead]);

  const handleChatFolderUpdateMute = useCallback(
    (value: number) => {
      onChatFolderUpdateMute(chatFolderId, value);
    },
    [chatFolderId, onChatFolderUpdateMute]
  );

  const handleChatFolderOpenSettings = useCallback(() => {
    onChatFolderOpenSettings(chatFolderId);
  }, [chatFolderId, onChatFolderOpenSettings]);

  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        {someChatsUnread && (
          <AxoContextMenu.Item
            symbol="message-check"
            onSelect={handleChatFolderMarkRead}
          >
            {i18n('icu:LeftPaneChatFolders__Item__ContextMenu__MarkAllRead')}
          </AxoContextMenu.Item>
        )}
        {!showOnlyUnmuteAll && (
          <AxoContextMenu.Sub>
            <AxoContextMenu.SubTrigger symbol="bell-slash">
              {i18n(
                'icu:LeftPaneChatFolders__Item__ContextMenu__MuteNotifications'
              )}
            </AxoContextMenu.SubTrigger>
            <AxoContextMenu.SubContent>
              {someChatsMuted && (
                <ContextMenuMuteNotificationsItem
                  value={0}
                  onSelect={handleChatFolderUpdateMute}
                >
                  {i18n(
                    'icu:LeftPaneChatFolders__Item__ContextMenu__MuteNotifications__UnmuteAll'
                  )}
                </ContextMenuMuteNotificationsItem>
              )}
              {muteValuesOptions.map(option => {
                return (
                  <ContextMenuMuteNotificationsItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleChatFolderUpdateMute}
                  >
                    {option.name}
                  </ContextMenuMuteNotificationsItem>
                );
              })}
            </AxoContextMenu.SubContent>
          </AxoContextMenu.Sub>
        )}
        {showOnlyUnmuteAll && (
          <ContextMenuMuteNotificationsItem
            symbol="bell"
            value={0}
            onSelect={handleChatFolderUpdateMute}
          >
            {i18n('icu:LeftPaneChatFolders__Item__ContextMenu__UnmuteAll')}
          </ContextMenuMuteNotificationsItem>
        )}
        {props.chatFolder.folderType === ChatFolderType.CUSTOM && (
          <AxoContextMenu.Item
            symbol="pencil"
            onSelect={handleChatFolderOpenSettings}
          >
            {i18n('icu:LeftPaneChatFolders__Item__ContextMenu__EditFolder')}
          </AxoContextMenu.Item>
        )}
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}

function ContextMenuMuteNotificationsItem(props: {
  symbol?: AxoSymbol.IconName;
  value: number;
  onSelect: (value: number) => void;
  children: ReactNode;
}): JSX.Element {
  const { value, onSelect } = props;
  const handleSelect = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);
  return (
    <AxoContextMenu.Item symbol={props.symbol} onSelect={handleSelect}>
      {props.children}
    </AxoContextMenu.Item>
  );
}
