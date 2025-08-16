// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { getAllConversationsUnreadStats } from './conversations';
import { getStoriesNotificationCount } from './stories';
import { getCallHistoryUnreadCount } from './callHistory';
import { NavTab } from '../../types/Nav';

import type { StateType } from '../reducer';
import type { NavStateType } from '../ducks/nav';
import type { UnreadStats } from '../../util/countUnreadStats';

function getNav(state: StateType): NavStateType {
  return state.nav;
}

export const getSelectedNavTab = createSelector(getNav, nav => {
  return nav.selectedLocation.tab;
});

export const getSelectedLocation = createSelector(getNav, nav => {
  return nav.selectedLocation;
});

export const getOtherTabsUnreadStats = createSelector(
  getSelectedNavTab,
  getAllConversationsUnreadStats,
  getCallHistoryUnreadCount,
  getStoriesNotificationCount,
  (
    selectedNavTab,
    conversationsUnreadStats,
    callHistoryUnreadCount,
    storiesNotificationCount
  ): UnreadStats => {
    let unreadCount = 0;
    let unreadMentionsCount = 0;
    let markedUnread = false;

    if (selectedNavTab !== NavTab.Chats) {
      unreadCount += conversationsUnreadStats.unreadCount;
      unreadMentionsCount += conversationsUnreadStats.unreadMentionsCount;
      markedUnread ||= conversationsUnreadStats.markedUnread;
    }

    // Note: Conversation unread stats includes the call history unread count.
    if (selectedNavTab !== NavTab.Calls) {
      unreadCount += callHistoryUnreadCount;
    }

    if (selectedNavTab !== NavTab.Stories) {
      unreadCount += storiesNotificationCount;
    }

    return {
      unreadCount,
      unreadMentionsCount,
      markedUnread,
    };
  }
);
