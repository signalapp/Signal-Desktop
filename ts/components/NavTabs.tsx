// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Key } from 'react';
import React from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import classNames from 'classnames';
import { Avatar, AvatarSize } from './Avatar';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { BadgeType } from '../badges/types';
import { NavTab } from '../state/ducks/nav';
import { Tooltip, TooltipPlacement } from './Tooltip';
import { Theme } from '../util/theme';
import type { UnreadStats } from '../util/countUnreadStats';
import { ContextMenu } from './ContextMenu';

type NavTabsItemBadgesProps = Readonly<{
  i18n: LocalizerType;
  hasError?: boolean;
  hasPendingUpdate?: boolean;
  unreadStats: UnreadStats | null;
}>;

function NavTabsItemBadges({
  i18n,
  hasError,
  hasPendingUpdate,
  unreadStats,
}: NavTabsItemBadgesProps) {
  if (hasError) {
    return (
      <span className="NavTabs__ItemUnreadBadge">
        <span className="NavTabs__ItemIconLabel">
          {i18n('icu:NavTabs__ItemIconLabel--HasError')}
        </span>
        <span aria-hidden>!</span>
      </span>
    );
  }

  if (hasPendingUpdate) {
    return <div className="NavTabs__ItemUpdateBadge" />;
  }

  if (unreadStats != null) {
    if (unreadStats.unreadCount > 0) {
      return (
        <span className="NavTabs__ItemUnreadBadge">
          <span className="NavTabs__ItemIconLabel">
            {i18n('icu:NavTabs__ItemIconLabel--UnreadCount', {
              count: unreadStats.unreadCount,
            })}
          </span>
          <span aria-hidden>{unreadStats.unreadCount}</span>
        </span>
      );
    }

    if (unreadStats.markedUnread) {
      return (
        <span className="NavTabs__ItemUnreadBadge">
          <span className="NavTabs__ItemIconLabel">
            {i18n('icu:NavTabs__ItemIconLabel--MarkedUnread')}
          </span>
        </span>
      );
    }
  }

  return null;
}

type NavTabProps = Readonly<{
  i18n: LocalizerType;
  iconClassName: string;
  id: NavTab;
  hasError?: boolean;
  label: string;
  unreadStats: UnreadStats | null;
}>;

function NavTabsItem({
  i18n,
  iconClassName,
  id,
  label,
  unreadStats,
  hasError,
}: NavTabProps) {
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  return (
    <Tab id={id} data-testid={`NavTabsItem--${id}`} className="NavTabs__Item">
      <span className="NavTabs__ItemLabel">{label}</span>
      <Tooltip
        content={label}
        theme={Theme.Dark}
        direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
        delay={600}
      >
        <span className="NavTabs__ItemButton">
          <span className="NavTabs__ItemContent">
            <span
              role="presentation"
              className={`NavTabs__ItemIcon ${iconClassName}`}
            />
            <NavTabsItemBadges
              i18n={i18n}
              unreadStats={unreadStats}
              hasError={hasError}
            />
          </span>
        </span>
      </Tooltip>
    </Tab>
  );
}

export type NavTabPanelProps = Readonly<{
  otherTabsUnreadStats: UnreadStats;
  collapsed: boolean;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  onToggleCollapse(collapsed: boolean): void;
}>;

export type NavTabsToggleProps = Readonly<{
  otherTabsUnreadStats: UnreadStats | null;
  i18n: LocalizerType;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse(navTabsCollapsed: boolean): void;
}>;

export function NavTabsToggle({
  i18n,
  hasFailedStorySends,
  hasPendingUpdate,
  navTabsCollapsed,
  otherTabsUnreadStats,
  onToggleNavTabsCollapse,
}: NavTabsToggleProps): JSX.Element {
  function handleToggle() {
    onToggleNavTabsCollapse(!navTabsCollapsed);
  }
  const label = navTabsCollapsed
    ? i18n('icu:NavTabsToggle__showTabs')
    : i18n('icu:NavTabsToggle__hideTabs');
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  return (
    <button
      type="button"
      className="NavTabs__Item NavTabs__Toggle"
      onClick={handleToggle}
    >
      <Tooltip
        content={label}
        theme={Theme.Dark}
        direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
        delay={600}
      >
        <span className="NavTabs__ItemButton">
          <span className="NavTabs__ItemContent">
            <span
              role="presentation"
              className="NavTabs__ItemIcon NavTabs__ItemIcon--Menu"
            />
            <span className="NavTabs__ItemLabel">{label}</span>
            <NavTabsItemBadges
              i18n={i18n}
              unreadStats={otherTabsUnreadStats}
              hasError={hasFailedStorySends}
              hasPendingUpdate={hasPendingUpdate}
            />
          </span>
        </span>
      </Tooltip>
    </button>
  );
}

export type NavTabsProps = Readonly<{
  badge: BadgeType | undefined;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  i18n: LocalizerType;
  me: ConversationType;
  navTabsCollapsed: boolean;
  onShowSettings: () => void;
  onStartUpdate: () => unknown;
  onNavTabSelected(tab: NavTab): void;
  onToggleNavTabsCollapse(collapsed: boolean): void;
  onToggleProfileEditor: () => void;
  renderCallsTab(props: NavTabPanelProps): JSX.Element;
  renderChatsTab(props: NavTabPanelProps): JSX.Element;
  renderStoriesTab(props: NavTabPanelProps): JSX.Element;
  selectedNavTab: NavTab;
  storiesEnabled: boolean;
  theme: ThemeType;
  unreadCallsCount: number;
  unreadConversationsStats: UnreadStats;
  unreadStoriesCount: number;
}>;

export function NavTabs({
  badge,
  hasFailedStorySends,
  hasPendingUpdate,
  i18n,
  me,
  navTabsCollapsed,
  onShowSettings,
  onStartUpdate,
  onNavTabSelected,
  onToggleNavTabsCollapse,
  onToggleProfileEditor,
  renderCallsTab,
  renderChatsTab,
  renderStoriesTab,
  selectedNavTab,
  storiesEnabled,
  theme,
  unreadCallsCount,
  unreadConversationsStats,
  unreadStoriesCount,
}: NavTabsProps): JSX.Element {
  function handleSelectionChange(key: Key) {
    onNavTabSelected(key as NavTab);
  }

  const isRTL = i18n.getLocaleDirection() === 'rtl';

  return (
    <Tabs
      orientation="vertical"
      className="NavTabs__Container"
      selectedKey={selectedNavTab}
      onSelectionChange={handleSelectionChange}
    >
      <nav
        data-supertab
        className={classNames('NavTabs', {
          'NavTabs--collapsed': navTabsCollapsed,
        })}
      >
        <NavTabsToggle
          i18n={i18n}
          navTabsCollapsed={navTabsCollapsed}
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
          // These are all shown elsewhere when nav tabs are shown
          hasFailedStorySends={false}
          hasPendingUpdate={false}
          otherTabsUnreadStats={null}
        />
        <TabList className="NavTabs__TabList">
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Chats}
            label={i18n('icu:NavTabs__ItemLabel--Chats')}
            iconClassName="NavTabs__ItemIcon--Chats"
            unreadStats={unreadConversationsStats}
          />
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Calls}
            label={i18n('icu:NavTabs__ItemLabel--Calls')}
            iconClassName="NavTabs__ItemIcon--Calls"
            unreadStats={{
              unreadCount: unreadCallsCount,
              unreadMentionsCount: 0,
              markedUnread: false,
            }}
          />
          {storiesEnabled && (
            <NavTabsItem
              i18n={i18n}
              id={NavTab.Stories}
              label={i18n('icu:NavTabs__ItemLabel--Stories')}
              iconClassName="NavTabs__ItemIcon--Stories"
              hasError={hasFailedStorySends}
              unreadStats={{
                unreadCount: unreadStoriesCount,
                unreadMentionsCount: 0,
                markedUnread: false,
              }}
            />
          )}
        </TabList>
        <div className="NavTabs__Misc">
          <ContextMenu
            i18n={i18n}
            menuOptions={[
              {
                icon: 'NavTabs__ContextMenuIcon--Settings',
                label: i18n('icu:NavTabs__ItemLabel--Settings'),
                onClick: onShowSettings,
              },
              {
                icon: 'NavTabs__ContextMenuIcon--Update',
                label: i18n('icu:NavTabs__ItemLabel--Update'),
                onClick: onStartUpdate,
              },
            ]}
            popperOptions={{
              placement: 'top-start',
              strategy: 'absolute',
            }}
            portalToRoot
          >
            {({ onClick, onKeyDown, ref }) => {
              return (
                <button
                  type="button"
                  className="NavTabs__Item"
                  onKeyDown={event => {
                    if (hasPendingUpdate) {
                      onKeyDown(event);
                    }
                  }}
                  onClick={event => {
                    if (hasPendingUpdate) {
                      onClick(event);
                    } else {
                      onShowSettings();
                    }
                  }}
                >
                  <Tooltip
                    content={i18n('icu:NavTabs__ItemLabel--Settings')}
                    theme={Theme.Dark}
                    direction={TooltipPlacement.Right}
                    delay={600}
                  >
                    <span className="NavTabs__ItemButton" ref={ref}>
                      <span className="NavTabs__ItemContent">
                        <span
                          role="presentation"
                          className="NavTabs__ItemIcon NavTabs__ItemIcon--Settings"
                        />
                        <span className="NavTabs__ItemLabel">
                          {i18n('icu:NavTabs__ItemLabel--Settings')}
                        </span>

                        <NavTabsItemBadges
                          i18n={i18n}
                          unreadStats={null}
                          hasPendingUpdate={hasPendingUpdate}
                        />
                      </span>
                    </span>
                  </Tooltip>
                </button>
              );
            }}
          </ContextMenu>

          <button
            type="button"
            className="NavTabs__Item NavTabs__Item--Profile"
            onClick={() => {
              onToggleProfileEditor();
            }}
            aria-label={i18n('icu:NavTabs__ItemLabel--Profile')}
          >
            <Tooltip
              content={i18n('icu:NavTabs__ItemLabel--Profile')}
              theme={Theme.Dark}
              direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
              delay={600}
            >
              <span className="NavTabs__ItemButton">
                <span className="NavTabs__ItemContent">
                  <Avatar
                    acceptedMessageRequest
                    avatarUrl={me.avatarUrl}
                    badge={badge}
                    className="module-main-header__avatar"
                    color={me.color}
                    conversationType="direct"
                    i18n={i18n}
                    isMe
                    phoneNumber={me.phoneNumber}
                    profileName={me.profileName}
                    theme={theme}
                    title={me.title}
                    // `sharedGroupNames` makes no sense for yourself, but
                    // `<Avatar>` needs it to determine blurring.
                    sharedGroupNames={[]}
                    size={AvatarSize.TWENTY_EIGHT}
                  />
                </span>
              </span>
            </Tooltip>
          </button>
        </div>
      </nav>
      <TabPanel id={NavTab.Chats} className="NavTabs__TabPanel">
        {renderChatsTab}
      </TabPanel>
      <TabPanel id={NavTab.Calls} className="NavTabs__TabPanel">
        {renderCallsTab}
      </TabPanel>
      <TabPanel id={NavTab.Stories} className="NavTabs__TabPanel">
        {renderStoriesTab}
      </TabPanel>
    </Tabs>
  );
}
