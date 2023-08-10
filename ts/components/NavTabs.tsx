// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Key, ReactNode } from 'react';
import React, { useEffect, useState } from 'react';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'react-aria-components';
import classNames from 'classnames';
import { usePopper } from 'react-popper';
import { createPortal } from 'react-dom';
import { Avatar, AvatarSize } from './Avatar';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { BadgeType } from '../badges/types';
import { AvatarPopup } from './AvatarPopup';
import { handleOutsideClick } from '../util/handleOutsideClick';
import type { UnreadStats } from '../state/selectors/conversations';
import { NavTab } from '../state/ducks/nav';
import { Tooltip, TooltipPlacement } from './Tooltip';
import { Theme } from '../util/theme';

type NavTabProps = Readonly<{
  i18n: LocalizerType;
  badge?: ReactNode;
  iconClassName: string;
  id: NavTab;
  label: string;
}>;

function NavTabsItem({ i18n, badge, iconClassName, id, label }: NavTabProps) {
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
            {badge && <span className="NavTabs__ItemBadge">{badge}</span>}
          </span>
        </span>
      </Tooltip>
    </Tab>
  );
}

export type NavTabPanelProps = Readonly<{
  collapsed: boolean;
  onToggleCollapse(collapsed: boolean): void;
}>;

export type NavTabsToggleProps = Readonly<{
  i18n: LocalizerType;
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse(navTabsCollapsed: boolean): void;
}>;

export function NavTabsToggle({
  i18n,
  navTabsCollapsed,
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
          <span
            role="presentation"
            className="NavTabs__ItemIcon NavTabs__ItemIcon--Menu"
          />
          <span className="NavTabs__ItemLabel">{label}</span>
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
  unreadConversationsStats,
  unreadStoriesCount,
}: NavTabsProps): JSX.Element {
  function handleSelectionChange(key: Key) {
    onNavTabSelected(key as NavTab);
  }

  const isRTL = i18n.getLocaleDirection() === 'rtl';

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  const [showAvatarPopup, setShowAvatarPopup] = useState(false);

  const popper = usePopper(targetElement, popperElement, {
    placement: 'bottom-start',
    strategy: 'fixed',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [null, 4],
        },
      },
    ],
  });

  useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setPortalElement(div);
    return () => {
      div.remove();
      setPortalElement(null);
    };
  }, []);

  useEffect(() => {
    return handleOutsideClick(
      () => {
        if (!showAvatarPopup) {
          return false;
        }
        setShowAvatarPopup(false);
        return true;
      },
      {
        containerElements: [portalElement, targetElement],
        name: 'MainHeader.showAvatarPopup',
      }
    );
  }, [portalElement, targetElement, showAvatarPopup]);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (showAvatarPopup && event.key === 'Escape') {
        setShowAvatarPopup(false);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [showAvatarPopup]);

  return (
    <Tabs orientation="vertical" className="NavTabs__Container">
      <nav
        className={classNames('NavTabs', {
          'NavTabs--collapsed': navTabsCollapsed,
        })}
      >
        <NavTabsToggle
          i18n={i18n}
          navTabsCollapsed={navTabsCollapsed}
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
        />
        <TabList
          className="NavTabs__TabList"
          selectedKey={selectedNavTab}
          onSelectionChange={handleSelectionChange}
        >
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Chats}
            label="Chats"
            iconClassName="NavTabs__ItemIcon--Chats"
            badge={
              // eslint-disable-next-line no-nested-ternary
              unreadConversationsStats.unreadCount > 0 ? (
                <>
                  <span className="NavTabs__ItemIconLabel">
                    {i18n('icu:NavTabs__ItemIconLabel--UnreadCount', {
                      count: unreadConversationsStats.unreadCount,
                    })}
                  </span>
                  <span aria-hidden>
                    {unreadConversationsStats.unreadCount}
                  </span>
                </>
              ) : unreadConversationsStats.markedUnread ? (
                <span className="NavTabs__ItemIconLabel">
                  {i18n('icu:NavTabs__ItemIconLabel--MarkedUnread')}
                </span>
              ) : null
            }
          />
          <NavTabsItem
            i18n={i18n}
            id={NavTab.Calls}
            label="Calls"
            iconClassName="NavTabs__ItemIcon--Calls"
          />
          {storiesEnabled && (
            <NavTabsItem
              i18n={i18n}
              id={NavTab.Stories}
              label="Stories"
              iconClassName="NavTabs__ItemIcon--Stories"
              badge={
                // eslint-disable-next-line no-nested-ternary
                hasFailedStorySends
                  ? '!'
                  : unreadStoriesCount > 0
                  ? unreadStoriesCount
                  : null
              }
            />
          )}
        </TabList>
        <div className="NavTabs__Misc">
          <button
            type="button"
            className="NavTabs__Item"
            onClick={onShowSettings}
          >
            <Tooltip
              content={i18n('icu:NavTabs__ItemLabel--Settings')}
              theme={Theme.Dark}
              direction={TooltipPlacement.Right}
              delay={600}
            >
              <span className="NavTabs__ItemButton">
                <span
                  role="presentation"
                  className="NavTabs__ItemIcon NavTabs__ItemIcon--Settings"
                />
                <span className="NavTabs__ItemLabel">
                  {i18n('icu:NavTabs__ItemLabel--Settings')}
                </span>
              </span>
            </Tooltip>
          </button>

          <button
            type="button"
            className="NavTabs__Item NavTabs__Item--Profile"
            data-supertab
            onClick={() => {
              setShowAvatarPopup(true);
            }}
            aria-label={i18n('icu:NavTabs__ItemLabel--Profile')}
          >
            <Tooltip
              content={i18n('icu:NavTabs__ItemLabel--Profile')}
              theme={Theme.Dark}
              direction={isRTL ? TooltipPlacement.Left : TooltipPlacement.Right}
              delay={600}
            >
              <span className="NavTabs__ItemButton" ref={setTargetElement}>
                <span className="NavTabs__ItemContent">
                  <Avatar
                    acceptedMessageRequest
                    avatarPath={me.avatarPath}
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
                  {hasPendingUpdate && <div className="NavTabs__AvatarBadge" />}
                </span>
              </span>
            </Tooltip>
          </button>
          {showAvatarPopup &&
            portalElement != null &&
            createPortal(
              <div
                id="MainHeader__AvatarPopup"
                ref={setPopperElement}
                style={{ ...popper.styles.popper, zIndex: 10 }}
                {...popper.attributes.popper}
              >
                <AvatarPopup
                  acceptedMessageRequest
                  badge={badge}
                  i18n={i18n}
                  isMe
                  color={me.color}
                  conversationType="direct"
                  name={me.name}
                  phoneNumber={me.phoneNumber}
                  profileName={me.profileName}
                  theme={theme}
                  title={me.title}
                  avatarPath={me.avatarPath}
                  hasPendingUpdate={hasPendingUpdate}
                  // See the comment above about `sharedGroupNames`.
                  sharedGroupNames={[]}
                  onEditProfile={() => {
                    onToggleProfileEditor();
                    setShowAvatarPopup(false);
                  }}
                  onStartUpdate={() => {
                    onStartUpdate();
                    setShowAvatarPopup(false);
                  }}
                  style={{}}
                />
              </div>,
              portalElement
            )}
        </div>
      </nav>
      <TabPanels>
        <TabPanel id={NavTab.Chats} className="NavTabs__TabPanel">
          {renderChatsTab}
        </TabPanel>
        <TabPanel id={NavTab.Calls} className="NavTabs__TabPanel">
          {renderCallsTab}
        </TabPanel>
        <TabPanel id={NavTab.Stories} className="NavTabs__TabPanel">
          {renderStoriesTab}
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
