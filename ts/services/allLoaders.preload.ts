// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// loader services
import { getBadgesForRedux, loadBadges } from './badgeLoader.preload.ts';
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountForRedux,
  loadCallHistory,
} from './callHistoryLoader.preload.ts';
import {
  getCallLinksForRedux,
  loadCallLinks,
} from './callLinksLoader.preload.ts';
import {
  getDistributionListsForRedux,
  loadDistributionLists,
} from './distributionListLoader.preload.ts';
import {
  getDonationsForRedux,
  loadDonationReceipts,
} from './donationsLoader.preload.ts';
import { getStoriesForRedux, loadStories } from './storyLoader.preload.ts';
import { getUserDataForRedux, loadUserData } from './userLoader.dom.ts';
import {
  loadCachedProfiles as loadNotificationProfiles,
  getCachedProfiles as getNotificationProfiles,
} from './notificationProfilesService.preload.ts';

// old-style loaders
import {
  getEmojiReducerState,
  loadRecentEmojis,
} from '../util/loadRecentEmojis.preload.ts';
import {
  load as loadStickers,
  getInitialState as getStickersReduxState,
} from '../types/Stickers.preload.ts';

import { type ReduxInitData } from '../state/initializeRedux.preload.ts';
import { reinitializeRedux } from '../state/reinitializeRedux.preload.ts';
import { getGifsStateForRedux, loadGifsState } from './gifsLoader.preload.ts';
import {
  getChatFoldersForRedux,
  loadChatFolders,
} from './chatFoldersLoader.preload.ts';
import { getInitialMegaphonesState } from '../state/ducks/megaphones.preload.ts';

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
    megaphones: getInitialMegaphonesState(),
    notificationProfiles: getNotificationProfiles(),
    recentEmoji: getEmojiReducerState(),
    stickers: getStickersReduxState(),
    stories: getStoriesForRedux(),
    storyDistributionLists: getDistributionListsForRedux(),
    theme,
  };
}
