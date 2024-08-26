// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// loader services
import { getBadgesForRedux, loadBadges } from './badgeLoader';
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountForRedux,
  loadCallHistory,
} from './callHistoryLoader';
import { getCallLinksForRedux, loadCallLinks } from './callLinksLoader';
import {
  getDistributionListsForRedux,
  loadDistributionLists,
} from './distributionListLoader';
import { getStoriesForRedux, loadStories } from './storyLoader';
import { getUserDataForRedux, loadUserData } from './userLoader';

// old-style loaders
import {
  getEmojiReducerState,
  loadRecentEmojis,
} from '../util/loadRecentEmojis';
import {
  load as loadStickers,
  getInitialState as getStickersReduxState,
} from '../types/Stickers';

import type { ReduxInitData } from '../state/initializeRedux';

export async function loadAll(): Promise<void> {
  await Promise.all([
    loadBadges(),
    loadCallHistory(),
    loadCallLinks(),
    loadDistributionLists(),
    loadRecentEmojis(),
    loadStickers(),
    loadStories(),
    loadUserData(),
  ]);
}

export function getParametersForRedux(): ReduxInitData {
  const { mainWindowStats, menuOptions, theme } = getUserDataForRedux();

  return {
    badgesState: getBadgesForRedux(),
    callHistory: getCallsHistoryForRedux(),
    callHistoryUnreadCount: getCallsHistoryUnreadCountForRedux(),
    callLinks: getCallLinksForRedux(),
    mainWindowStats,
    menuOptions,
    recentEmoji: getEmojiReducerState(),
    stickers: getStickersReduxState(),
    stories: getStoriesForRedux(),
    storyDistributionLists: getDistributionListsForRedux(),
    theme,
  };
}
