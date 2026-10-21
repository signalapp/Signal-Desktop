// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback } from 'react';
import type { ReactNode, JSX } from 'react';
import { useSelector } from 'react-redux';
import { NavTabs } from '../../components/NavTabs.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import {
  getAllConversationsUnreadStats,
  getCallHistoryUnreadCount,
} from '../selectors/conversations.dom.ts';
import {
  getHasAnyFailedStorySends,
  getStoriesNotificationCount,
} from '../selectors/stories.preload.ts';
import {
  getStoriesEnabled,
  getUnreadCountBadgeType,
} from '../selectors/items.dom.ts';
import { getSelectedNavTab } from '../selectors/nav.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { getHasPendingUpdate } from '../selectors/updates.std.ts';
import {
  getIsSearching,
  getIsSearchingInAConversation,
} from '../selectors/search.preload.ts';
import { useSearchActions } from '../ducks/search.preload.ts';

import { NavTab } from '../../types/Nav.std.ts';
import type { Location } from '../../types/Nav.std.ts';

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
  const unreadCountBadgeType = useSelector(getUnreadCountBadgeType);
  const storiesEnabled = useSelector(getStoriesEnabled);
  const unreadConversationsStats = useSelector(getAllConversationsUnreadStats);
  const unreadStoriesCount = useSelector(getStoriesNotificationCount);
  const unreadCallsCount = useSelector(getCallHistoryUnreadCount);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const isSearching = useSelector(getIsSearching);
  const isSearchingInAConversation = useSelector(
    getIsSearchingInAConversation
  );

  const { changeLocation } = useNavActions();
  const { clearSearchQuery, endConversationSearch, endSearch } =
    useSearchActions();

  const onChangeLocation = useCallback(
    (location: Location) => {
      // For some reason react-aria will call this more often than the tab
      // actually changing.
      if (location.tab !== selectedNavTab) {
        void changeLocation(location);
        return;
      }

      // Pressing the already selected Chats tab resets the left pane search
      if (location.tab === NavTab.Chats && isSearching) {
        if (isSearchingInAConversation) {
          endConversationSearch();
        }
        clearSearchQuery();
        endSearch();
      }
    },
    [
      changeLocation,
      clearSearchQuery,
      endConversationSearch,
      endSearch,
      isSearching,
      isSearchingInAConversation,
      selectedNavTab,
    ]
  );

  return (
    <NavTabs
      unreadCountBadgeType={unreadCountBadgeType}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      i18n={i18n}
      navTabsCollapsed={navTabsCollapsed}
      onChangeLocation={onChangeLocation}
      onToggleNavTabsCollapse={onToggleNavTabsCollapse}
      renderCallsTab={renderCallsTab}
      renderChatsTab={renderChatsTab}
      renderStoriesTab={renderStoriesTab}
      renderSettingsTab={renderSettingsTab}
      selectedNavTab={selectedNavTab}
      storiesEnabled={storiesEnabled}
      unreadCallsCount={unreadCallsCount}
      unreadConversationsStats={unreadConversationsStats}
      unreadStoriesCount={unreadStoriesCount}
    />
  );
});
