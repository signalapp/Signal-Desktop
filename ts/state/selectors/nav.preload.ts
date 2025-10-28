// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { getAllConversationsUnreadStats } from './conversations.dom.js';
import { getStoriesNotificationCount } from './stories.preload.js';
import { getCallHistoryUnreadCount } from './callHistory.std.js';
import { NavTab } from '../../types/Nav.std.js';

import type { StateType } from '../reducer.preload.js';
import type { NavStateType } from '../ducks/nav.std.js';
import type { UnreadStats } from '../../util/countUnreadStats.std.js';

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
    let readChatsMarkedUnreadCount = 0;

    if (selectedNavTab !== NavTab.Chats) {
      unreadCount += conversationsUnreadStats.unreadCount;
      unreadMentionsCount += conversationsUnreadStats.unreadMentionsCount;
      readChatsMarkedUnreadCount +=
        conversationsUnreadStats.readChatsMarkedUnreadCount;
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
      readChatsMarkedUnreadCount,
    };
  }
);
