// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Key, ReactNode } from 'react';
import React, { useState } from 'react';
import { Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import classNames from 'classnames';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { BadgeType } from '../badges/types.std.js';
import { NavTab, ProfileEditorPage, SettingsPage } from '../types/Nav.std.js';
import type { Location } from '../types/Nav.std.js';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';
import { Theme } from '../util/theme.std.js';
import type { UnreadStats } from '../util/countUnreadStats.std.js';
import { ProfileMovedModal } from './ProfileMovedModal.dom.js';

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
      const total =
        unreadStats.unreadCount + unreadStats.readChatsMarkedUnreadCount;
      return (
        <span className="NavTabs__ItemUnreadBadge">
          <span className="NavTabs__ItemIconLabel">
            {i18n('icu:NavTabs__ItemIconLabel--UnreadCount', {
              count: total,
            })}
          </span>
          <span aria-hidden>{total}</span>
        </span>
      );
    }

    if (unreadStats.readChatsMarkedUnreadCount > 0) {
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
  hasError?: boolean;
  i18n: LocalizerType;
  iconClassName: string;
  id: NavTab;
  label: string;
  navTabClassName: string;
  unreadStats: UnreadStats | null;
  hasPendingUpdate?: boolean;
}>;

function NavTabsItem({
  hasError,
  i18n,
  iconClassName,
  id,
  label,
  navTabClassName,
  unreadStats,
  hasPendingUpdate,
}: NavTabProps) {
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  return (
    <Tab
      id={id}
      data-testid={`NavTabsItem--${id}`}
      className={classNames('NavTabs__Item', navTabClassName)}
    >
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
              hasPendingUpdate={hasPendingUpdate}
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
  onChangeLocation: (location: Location) => void;
  onDismissProfileMovedModal: () => void;
  onToggleNavTabsCollapse: (collapsed: boolean) => void;
  profileMovedModalNeeded: boolean;
  renderCallsTab: () => ReactNode;
  renderChatsTab: () => ReactNode;
  renderStoriesTab: () => ReactNode;
  renderSettingsTab: () => ReactNode;
  selectedNavTab: NavTab;
  shouldShowProfileIcon: boolean;
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
  onChangeLocation,
  onDismissProfileMovedModal,
  onToggleNavTabsCollapse,
  profileMovedModalNeeded,
  renderCallsTab,
  renderChatsTab,
  renderStoriesTab,
  renderSettingsTab,
  selectedNavTab,
  shouldShowProfileIcon,
  storiesEnabled,
  theme,
  unreadCallsCount,
  unreadConversationsStats,
  unreadStoriesCount,
}: NavTabsProps): JSX.Element {
  const [showingProfileMovedModal, setShowingProfileMovedModal] =
    useState(false);

  function handleSelectionChange(key: Key) {
    const tab = key as NavTab;
    if (tab === NavTab.Settings) {
      onChangeLocation({
        tab: NavTab.Settings,
        details: {
          page: SettingsPage.Profile,
          state: ProfileEditorPage.None,
        },
      });
    } else {
      onChangeLocation({ tab });
    }
  }

  const isRTL = i18n.getLocaleDirection() === 'rtl';

  return (
    <Tabs
      orientation="vertical"
      className="NavTabs__Container"
      selectedKey={selectedNavTab}
      onSelectionChange={handleSelectionChange}
    >
      {showingProfileMovedModal ? (
        <ProfileMovedModal
          i18n={i18n}
          onClose={() => {
            setShowingProfileMovedModal(false);
            onDismissProfileMovedModal();
          }}
          theme={theme}
        />
      ) : undefined}
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
            navTabClassName="NavTabs__Item--Chats"
            unreadStats={unreadConversationsStats}
          />
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Calls}
            label={i18n('icu:NavTabs__ItemLabel--Calls')}
            iconClassName="NavTabs__ItemIcon--Calls"
            navTabClassName="NavTabs__Item--Calls"
            unreadStats={{
              unreadCount: unreadCallsCount,
              unreadMentionsCount: 0,
              readChatsMarkedUnreadCount: 0,
            }}
          />
          {storiesEnabled && (
            <NavTabsItem
              i18n={i18n}
              id={NavTab.Stories}
              label={i18n('icu:NavTabs__ItemLabel--Stories')}
              iconClassName="NavTabs__ItemIcon--Stories"
              hasError={hasFailedStorySends}
              navTabClassName="NavTabs__Item--Stories"
              unreadStats={{
                unreadCount: unreadStoriesCount,
                unreadMentionsCount: 0,
                readChatsMarkedUnreadCount: 0,
              }}
            />
          )}
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Settings}
            label={i18n('icu:NavTabs__ItemLabel--Settings')}
            iconClassName="NavTabs__ItemIcon--Settings"
            navTabClassName="NavTabs__Item--Settings"
            unreadStats={null}
            hasPendingUpdate={hasPendingUpdate}
          />
        </TabList>
        {shouldShowProfileIcon && (
          <div className="NavTabs__Misc">
            <button
              type="button"
              className="NavTabs__Item NavTabs__Item--Profile"
              onClick={() => {
                if (profileMovedModalNeeded) {
                  setShowingProfileMovedModal(true);
                } else {
                  handleSelectionChange(NavTab.Settings);
                }
              }}
              aria-label={i18n('icu:NavTabs__ItemLabel--Profile')}
            >
              <Tooltip
                content={i18n('icu:NavTabs__ItemLabel--Profile')}
                theme={Theme.Dark}
                direction={
                  isRTL ? TooltipPlacement.Left : TooltipPlacement.Right
                }
                delay={600}
              >
                <span className="NavTabs__ItemButton">
                  <span className="NavTabs__ItemContent">
                    <Avatar
                      avatarUrl={me.avatarUrl}
                      badge={badge}
                      className="module-main-header__avatar"
                      color={me.color}
                      conversationType="direct"
                      i18n={i18n}
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
        )}
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
      <TabPanel id={NavTab.Settings} className="NavTabs__TabPanel">
        {renderSettingsTab}
      </TabPanel>
    </Tabs>
  );
}
