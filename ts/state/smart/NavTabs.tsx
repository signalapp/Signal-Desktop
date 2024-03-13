// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { NavTabPanelProps } from '../../components/NavTabs';
import { NavTabs } from '../../components/NavTabs';
import { getIntl, getTheme } from '../selectors/user';
import {
  getAllConversationsUnreadStats,
  getMe,
} from '../selectors/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getHasAnyFailedStorySends,
  getStoriesNotificationCount,
} from '../selectors/stories';
import { showSettings } from '../../shims/Whisper';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useUpdatesActions } from '../ducks/updates';
import { getStoriesEnabled } from '../selectors/items';
import { getSelectedNavTab } from '../selectors/nav';
import type { NavTab } from '../ducks/nav';
import { useNavActions } from '../ducks/nav';
import { getHasPendingUpdate } from '../selectors/updates';
import { getCallHistoryUnreadCount } from '../selectors/callHistory';

export type SmartNavTabsProps = Readonly<{
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse(navTabsCollapsed: boolean): void;
  renderCallsTab(props: NavTabPanelProps): JSX.Element;
  renderChatsTab(props: NavTabPanelProps): JSX.Element;
  renderStoriesTab(props: NavTabPanelProps): JSX.Element;
}>;

export const SmartNavTabs = memo(function SmartNavTabs({
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderCallsTab,
  renderChatsTab,
  renderStoriesTab,
}: SmartNavTabsProps): JSX.Element {
  const i18n = useSelector(getIntl);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const { changeNavTab } = useNavActions();
  const me = useSelector(getMe);
  const badge = useSelector(getPreferredBadgeSelector)(me.badges);
  const theme = useSelector(getTheme);
  const storiesEnabled = useSelector(getStoriesEnabled);
  const unreadConversationsStats = useSelector(getAllConversationsUnreadStats);
  const unreadStoriesCount = useSelector(getStoriesNotificationCount);
  const unreadCallsCount = useSelector(getCallHistoryUnreadCount);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);

  const { toggleProfileEditor } = useGlobalModalActions();
  const { startUpdate } = useUpdatesActions();

  const onNavTabSelected = useCallback(
    (tab: NavTab) => {
      // For some reason react-aria will call this more often than the tab
      // actually changing.
      if (tab !== selectedNavTab) {
        changeNavTab(tab);
      }
    },
    [changeNavTab, selectedNavTab]
  );

  return (
    <NavTabs
      badge={badge}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      me={me}
      navTabsCollapsed={navTabsCollapsed}
      onShowSettings={showSettings}
      onStartUpdate={startUpdate}
      onNavTabSelected={onNavTabSelected}
      onToggleNavTabsCollapse={onToggleNavTabsCollapse}
      onToggleProfileEditor={toggleProfileEditor}
      renderCallsTab={renderCallsTab}
      renderChatsTab={renderChatsTab}
      renderStoriesTab={renderStoriesTab}
      selectedNavTab={selectedNavTab}
      storiesEnabled={storiesEnabled}
      theme={theme}
      unreadCallsCount={unreadCallsCount}
      unreadConversationsStats={unreadConversationsStats}
      unreadStoriesCount={unreadStoriesCount}
    />
  );
});
