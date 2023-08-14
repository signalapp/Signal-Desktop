// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { NavStateType } from '../ducks/nav';
import { getAllConversationsUnreadStats } from './conversations';
import { getStoriesNotificationCount } from './stories';
import type { UnreadStats } from '../../util/countUnreadStats';

function getNav(state: StateType): NavStateType {
  return state.nav;
}

export const getSelectedNavTab = createSelector(getNav, nav => {
  return nav.selectedNavTab;
});

export const getAppUnreadStats = createSelector(
  getAllConversationsUnreadStats,
  getStoriesNotificationCount,
  (conversationsUnreadStats, storiesNotificationCount): UnreadStats => {
    return {
      // Note: Conversation unread stats includes the call history unread count.
      unreadCount:
        conversationsUnreadStats.unreadCount + storiesNotificationCount,
      unreadMentionsCount: conversationsUnreadStats.unreadMentionsCount,
      markedUnread: conversationsUnreadStats.markedUnread,
    };
  }
);
