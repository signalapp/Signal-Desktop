// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// loader services
import {
  getCallsHistoryForRedux,
  getCallsHistoryUnreadCountForRedux,
  loadCallHistory,
} from './callHistoryLoader.preload.js';
import {
  getCallLinksForRedux,
  loadCallLinks,
} from './callLinksLoader.preload.js';
import {
  getDistributionListsForRedux,
  loadDistributionLists,
} from './distributionListLoader.preload.js'; // Stub only
import { getStoriesForRedux, loadStories } from './storyLoader.preload.js'; // Stub only
import { getUserDataForRedux, loadUserData } from './userLoader.dom.js';
import {
  loadCachedProfiles as loadNotificationProfiles,
  getCachedProfiles as getNotificationProfiles,
} from './notificationProfilesService.preload.js';

// old-style loaders
import {
  getEmojiReducerState,
  loadRecentEmojis,
} from '../util/loadRecentEmojis.preload.js';
import {
  load as loadStickers,
  getInitialState as getStickersReduxState,
} from '../types/Stickers.preload.js';

import { type ReduxInitData } from '../state/initializeRedux.preload.js';
import { reinitializeRedux } from '../state/reinitializeRedux.preload.js';
import { getGifsStateForRedux, loadGifsState } from './gifsLoader.preload.js';
import {
  getChatFoldersForRedux,
  loadChatFolders,
} from './chatFoldersLoader.preload.js';

export async function loadAll(): Promise<void> {
  await Promise.all([
    loadCallHistory(),
    loadCallLinks(),
    loadChatFolders(),
    loadDistributionLists(), // Stub only
    loadGifsState(),
    loadNotificationProfiles(),
    loadRecentEmojis(),
    loadStickers(),
    loadStories(), // Stub only
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
    callHistory: getCallsHistoryForRedux(),
    callHistoryUnreadCount: getCallsHistoryUnreadCountForRedux(),
    callLinks: getCallLinksForRedux(),
    chatFolders: getChatFoldersForRedux(),
    gifs: getGifsStateForRedux(),
    mainWindowStats,
    menuOptions,
    notificationProfiles: getNotificationProfiles(),
    recentEmoji: getEmojiReducerState(),
    stickers: getStickersReduxState(),
    stories: getStoriesForRedux(), // Stub only
    storyDistributionLists: getDistributionListsForRedux(), // Stub only
    theme,
  };
}
