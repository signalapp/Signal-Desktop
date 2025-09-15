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
import { getDonationsForRedux, loadDonationReceipts } from './donationsLoader';
import { getStoriesForRedux, loadStories } from './storyLoader';
import { getUserDataForRedux, loadUserData } from './userLoader';
import {
  loadCachedProfiles as loadNotificationProfiles,
  getCachedProfiles as getNotificationProfiles,
} from './notificationProfilesService';

// old-style loaders
import {
  getEmojiReducerState,
  loadRecentEmojis,
} from '../util/loadRecentEmojis';
import {
  load as loadStickers,
  getInitialState as getStickersReduxState,
} from '../types/Stickers';

import { type ReduxInitData } from '../state/initializeRedux';
import { reinitializeRedux } from '../state/reinitializeRedux';
import { getGifsStateForRedux, loadGifsState } from './gifsLoader';
import { getChatFoldersForRedux, loadChatFolders } from './chatFoldersLoader';

export async function loadAll(): Promise<void> {
  await Promise.all([
    loadBadges(),
    loadCallHistory(),
    loadCallLinks(),
    loadChatFolders(),
    loadDistributionLists(),
    loadDonationReceipts(),
    loadGifsState(),
    loadNotificationProfiles(),
    loadRecentEmojis(),
    loadStickers(),
    loadStories(),
    loadUserData(),
  ]);
}

export async function loadAllAndReinitializeRedux(): Promise<void> {
  await loadAll();
  reinitializeRedux(getParametersForRedux());
}

export function getParametersForRedux(): ReduxInitData {
  const { mainWindowStats, menuOptions, theme } = getUserDataForRedux();

  return {
    badgesState: getBadgesForRedux(),
    callHistory: getCallsHistoryForRedux(),
    callHistoryUnreadCount: getCallsHistoryUnreadCountForRedux(),
    callLinks: getCallLinksForRedux(),
    chatFolders: getChatFoldersForRedux(),
    donations: getDonationsForRedux(),
    gifs: getGifsStateForRedux(),
    mainWindowStats,
    menuOptions,
    notificationProfiles: getNotificationProfiles(),
    recentEmoji: getEmojiReducerState(),
    stickers: getStickersReduxState(),
    stories: getStoriesForRedux(),
    storyDistributionLists: getDistributionListsForRedux(),
    theme,
  };
}
