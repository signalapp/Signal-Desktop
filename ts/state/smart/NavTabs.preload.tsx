// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';

import type { ReactNode } from 'react';

import { useSelector } from 'react-redux';
import { NavTabs } from '../../components/NavTabs.dom.js';
import { getIntl, getTheme, getIsNightly } from '../selectors/user.std.js';
import {
  getAllConversationsUnreadStats,
  getMe} from '../selectors/conversations.dom.js';
import {
  getProfileMovedModalNeeded} from '../selectors/items.dom.js';
import { getSelectedNavTab } from '../selectors/nav.preload.js';
import { useNavActions } from '../ducks/nav.std.js';
import { getHasPendingUpdate } from '../selectors/updates.std.js';
import { getCallHistoryUnreadCount } from '../selectors/callHistory.std.js';
import { Environment } from '../../environment.std.js';
import { useItemsActions } from '../ducks/items.preload.js';

import type { Location } from '../../types/Nav.std.js';

export type SmartNavTabsProps = Readonly<{
  navTabsCollapsed: boolean;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  renderCallsTab: () => ReactNode;
  renderChatsTab: () => ReactNode;
  renderSettingsTab: () => ReactNode;
}>;

export const SmartNavTabs = memo(function SmartNavTabs({
  navTabsCollapsed,
  onToggleNavTabsCollapse,
  renderCallsTab,
  renderChatsTab,
  renderSettingsTab}: SmartNavTabsProps): JSX.Element {
  const i18n = useSelector(getIntl);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const me = useSelector(getMe);
  const theme = useSelector(getTheme);
  const unreadConversationsStats = useSelector(getAllConversationsUnreadStats);
  const unreadCallsCount = useSelector(getCallHistoryUnreadCount);
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
      renderSettingsTab={renderSettingsTab}
      selectedNavTab={selectedNavTab}
      shouldShowProfileIcon={shouldShowProfileIcon}
      theme={theme}
      unreadCallsCount={unreadCallsCount}
      unreadConversationsStats={unreadConversationsStats}
    />
  );
});
