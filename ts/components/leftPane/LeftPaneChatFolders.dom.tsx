// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { MuteExpiration } from '@signalapp/types';

import {
  useCallback,
  useMemo,
  type FocusEvent,
  type ReactNode,
  type JSX,
} from 'react';
import {
  ChatFolderType,
  type ChatFolder,
  type ChatFolderId,
} from '../../types/ChatFolder.std.ts';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { ExperimentalAxoSegmentedControl } from '../../axo/AxoSegmentedControl.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import type {
  AllChatFoldersUnreadStats,
  UnreadStats,
} from '../../util/countUnreadStats.std.ts';
import { WidthBreakpoint } from '../_util.std.ts';
import { AxoSelect } from '../../axo/AxoSelect.dom.tsx';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.tsx';
import { getMuteValuesOptions } from '../../util/getMuteOptions.std.ts';
import { MuteNotificationsSubMenu } from '../MuteNotificationsMenu.dom.tsx';
import type {
  AllChatFoldersMutedStats,
  MutedStats,
} from '../../util/countMutedStats.std.ts';
import type { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { CurrentChatFolders } from '../../types/CurrentChatFolders.std.ts';

export type LeftPaneChatFoldersProps = Readonly<{
  i18n: LocalizerType;
  navSidebarWidthBreakpoint: WidthBreakpoint | null;
  currentChatFolders: CurrentChatFolders;
  allChatFoldersUnreadStats: AllChatFoldersUnreadStats;
  allChatFoldersMutedStats: AllChatFoldersMutedStats;
  selectedChatFolder: ChatFolder | null;
  onSelectedChatFolderIdChange: (newValue: ChatFolderId) => void;
  onChatFolderMarkRead: (chatFolderId: ChatFolderId) => void;
  onChatFolderUpdateMute: (
    chatFolderId: ChatFolderId,
    muteExpiresAt: MuteExpiration
  ) => void;
  onChatFolderOpenSettings: (chatFolderId: ChatFolderId) => void;
}>;

function getBadgeValue(unreadStats: UnreadStats | null): number | null {
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

function getChatFolderIconName(chatFolder: ChatFolder | null): AxoSymbol.Name {
  if (chatFolder == null) {
    return 'message';
  }

  return chatFolder.folderType === ChatFolderType.ALL ? 'message' : 'folder';
}

// Needed to conditionally apply margin after network warning/update available
const LEFT_PANE_CHAT_FOLDERS_CLASS_NAME = 'module-left-pane__chatFolders';

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
      <div className={tw(LEFT_PANE_CHAT_FOLDERS_CLASS_NAME, 'px-2')}>
        <AxoSelect.Root
          value={props.selectedChatFolder?.id ?? null}
          onValueChange={handleValueChange}
        >
          <AxoSelect.Trigger
            variant="elevated"
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
        'scroll-px-[20%] scrollbar-width-none overflow-x-auto overflow-y-clip px-4 py-2'
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
        <AxoSelect.ItemBadge
          variant="primary"
          value={badgeValue}
          max={UNREAD_BADGE_MAX_COUNT}
          label={i18n(
            'icu:LeftPaneChatFolders__ItemUnreadBadge__AccessibleLabel',
            { count: badgeValue }
          )}
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
  onChatFolderUpdateMute: (
    chatFolderId: ChatFolderId,
    muteExpiresAt: MuteExpiration
  ) => void;
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
          <ExperimentalAxoSegmentedControl.ItemBadge
            variant="primary"
            value={badgeValue}
            max={UNREAD_BADGE_MAX_COUNT}
            label={i18n(
              'icu:LeftPaneChatFolders__ItemUnreadBadge__AccessibleLabel',
              { count: badgeValue }
            )}
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
  onChatFolderUpdateMute: (
    chatFolderId: ChatFolderId,
    muteExpiresAt: MuteExpiration
  ) => void;
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
    (muteExpiresAt: MuteExpiration) => {
      onChatFolderUpdateMute(chatFolderId, muteExpiresAt);
    },
    [chatFolderId, onChatFolderUpdateMute]
  );

  const handleChatFolderUnmuteAll = useCallback(() => {
    onChatFolderUpdateMute(chatFolderId, MuteExpiration.UNMUTED);
  }, [chatFolderId, onChatFolderUpdateMute]);

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
          <MuteNotificationsSubMenu
            i18n={i18n}
            renderer="AxoContextMenu"
            title={i18n(
              'icu:LeftPaneChatFolders__Item__ContextMenu__MuteNotifications'
            )}
            options={muteValuesOptions}
            onMuteExpiration={handleChatFolderUpdateMute}
          >
            {someChatsMuted && (
              <AxoContextMenu.Item onSelect={handleChatFolderUnmuteAll}>
                {i18n(
                  'icu:LeftPaneChatFolders__Item__ContextMenu__MuteNotifications__UnmuteAll'
                )}
              </AxoContextMenu.Item>
            )}
          </MuteNotificationsSubMenu>
        )}
        {showOnlyUnmuteAll && (
          <AxoContextMenu.Item
            symbol="bell"
            onSelect={handleChatFolderUnmuteAll}
          >
            {i18n('icu:LeftPaneChatFolders__Item__ContextMenu__UnmuteAll')}
          </AxoContextMenu.Item>
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
