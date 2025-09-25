// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// loader services
import { getBadgesForRedux, loadBadges } from './badgeLoader.js';
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountForRedux,
  loadCallHistory,
} from './callHistoryLoader.js';
import { getCallLinksForRedux, loadCallLinks } from './callLinksLoader.js';
import {
  getDistributionListsForRedux,
  loadDistributionLists,
} from './distributionListLoader.js';
import {
  getDonationsForRedux,
  loadDonationReceipts,
} from './donationsLoader.js';
import { getStoriesForRedux, loadStories } from './storyLoader.js';
import { getUserDataForRedux, loadUserData } from './userLoader.js';
import {
  loadCachedProfiles as loadNotificationProfiles,
  getCachedProfiles as getNotificationProfiles,
} from './notificationProfilesService.js';

// old-style loaders
import {
  getEmojiReducerState,
  loadRecentEmojis,
} from '../util/loadRecentEmojis.js';
import {
  load as loadStickers,
  getInitialState as getStickersReduxState,
} from '../types/Stickers.js';

import { type ReduxInitData } from '../state/initializeRedux.js';
import { reinitializeRedux } from '../state/reinitializeRedux.js';
import { getGifsStateForRedux, loadGifsState } from './gifsLoader.js';
import {
  getChatFoldersForRedux,
  loadChatFolders,
} from './chatFoldersLoader.js';

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
