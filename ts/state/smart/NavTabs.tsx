// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';

import type { ReactNode } from 'react';

import { useSelector } from 'react-redux';
import { NavTabs } from '../../components/NavTabs.js';
import { getIntl, getTheme, getIsNightly } from '../selectors/user.js';
import {
  getAllConversationsUnreadStats,
  getMe,
} from '../selectors/conversations.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import {
  getHasAnyFailedStorySends,
  getStoriesNotificationCount,
} from '../selectors/stories.js';
import {
  getProfileMovedModalNeeded,
  getStoriesEnabled,
} from '../selectors/items.js';
import { getSelectedNavTab } from '../selectors/nav.js';
import { useNavActions } from '../ducks/nav.js';
import { getHasPendingUpdate } from '../selectors/updates.js';
import { getCallHistoryUnreadCount } from '../selectors/callHistory.js';
import { Environment } from '../../environment.js';
import { useItemsActions } from '../ducks/items.js';

import type { Location } from '../../types/Nav.js';

export type SmartNavTabsProps = Readonly<{
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  renderCallsTab: () => ReactNode;
  renderChatsTab: () => ReactNode;
  renderStoriesTab: () => ReactNode;
  renderSettingsTab: () => ReactNode;
}>;

export const SmartNavTabs = memo(function SmartNavTabs({
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderCallsTab,
  renderChatsTab,
  renderStoriesTab,
  renderSettingsTab,
}: SmartNavTabsProps): JSX.Element {
  const i18n = useSelector(getIntl);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const me = useSelector(getMe);
  const badge = useSelector(getPreferredBadgeSelector)(me.badges);
  const theme = useSelector(getTheme);
  const storiesEnabled = useSelector(getStoriesEnabled);
  const unreadConversationsStats = useSelector(getAllConversationsUnreadStats);
  const unreadStoriesCount = useSelector(getStoriesNotificationCount);
  const unreadCallsCount = useSelector(getCallHistoryUnreadCount);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const profileMovedModalNeeded = useSelector(getProfileMovedModalNeeded);
  const isNightly = useSelector(getIsNightly);

  const { changeLocation } = useNavActions();
  const { putItem } = useItemsActions();

  const shouldShowProfileIcon =
    profileMovedModalNeeded ||
    isNightly ||
    window.SignalContext.getEnvironment() !== Environment.PackagedApp;

  const onDismissProfileMovedModal = useCallback(() => {
    putItem('needProfileMovedModal', false);
  }, [putItem]);

  const onChangeLocation = useCallback(
    (location: Location) => {
      // For some reason react-aria will call this more often than the tab
      // actually changing.
      if (location.tab !== selectedNavTab) {
        changeLocation(location);
      }
    },
    [changeLocation, selectedNavTab]
  );

  return (
    <NavTabs
      badge={badge}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      me={me}
      navTabsCollapsed={navTabsCollapsed}
      onChangeLocation={onChangeLocation}
      onToggleNavTabsCollapse={onToggleNavTabsCollapse}
      profileMovedModalNeeded={profileMovedModalNeeded}
      onDismissProfileMovedModal={onDismissProfileMovedModal}
      renderCallsTab={renderCallsTab}
      renderChatsTab={renderChatsTab}
      renderStoriesTab={renderStoriesTab}
      renderSettingsTab={renderSettingsTab}
      selectedNavTab={selectedNavTab}
      shouldShowProfileIcon={shouldShowProfileIcon}
      storiesEnabled={storiesEnabled}
      theme={theme}
      unreadCallsCount={unreadCallsCount}
      unreadConversationsStats={unreadConversationsStats}
      unreadStoriesCount={unreadStoriesCount}
    />
  );
});
