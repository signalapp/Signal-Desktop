// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { bindActionCreators } from 'redux';
import { actionCreators } from './actions.preload.js';
import { createStore } from './createStore.preload.js';
import { getInitialState } from './getInitialState.preload.js';

import type { CallHistoryDetails } from '../types/CallDisposition.std.js';
import type { MainWindowStatsType } from '../windows/context.preload.js';
import type { MenuOptionsType } from '../types/menu.std.js';
import type { StoryDataType } from './ducks/stories.preload.js'; // Stub only
import type { StoryDistributionListDataType } from './ducks/storyDistributionLists.preload.js'; // Stub only
import type { ThemeType } from '../types/Util.std.js';
import type { CallLinkType } from '../types/CallLink.std.js';
import type { RecentEmojiObjectType } from '../util/loadRecentEmojis.preload.js';
import type { StickersStateType } from './ducks/stickers.preload.js';
import type { GifsStateType } from './ducks/gifs.preload.js';
import type { NotificationProfileType } from '../types/NotificationProfile.std.js';
import type { CurrentChatFolder } from '../types/CurrentChatFolders.std.js';

export type ReduxInitData = {
  callHistory: ReadonlyArray<CallHistoryDetails>;
  callHistoryUnreadCount: number;
  callLinks: ReadonlyArray<CallLinkType>;
  chatFolders: ReadonlyArray<CurrentChatFolder>;
  gifs: GifsStateType;
  mainWindowStats: MainWindowStatsType;
  menuOptions: MenuOptionsType;
  notificationProfiles: ReadonlyArray<NotificationProfileType>;
  recentEmoji: RecentEmojiObjectType;
  stickers: StickersStateType;
  stories: Array<StoryDataType>; // Stub only
  storyDistributionLists: Array<StoryDistributionListDataType>; // Stub only
  theme: ThemeType;
};

export function initializeRedux(data: ReduxInitData): void {
  const initialState = getInitialState(data);

  const store = createStore(initialState);
  window.reduxStore = store;

  // Binding these actions to our redux store and exposing them allows us to update
  //   redux when things change in the rest of the app.
  window.reduxActions = {
    accounts: bindActionCreators(actionCreators.accounts, store.dispatch),
    app: bindActionCreators(actionCreators.app, store.dispatch),
    installer: bindActionCreators(actionCreators.installer, store.dispatch),
    audioPlayer: bindActionCreators(actionCreators.audioPlayer, store.dispatch),
    audioRecorder: bindActionCreators(
      actionCreators.audioRecorder,
      store.dispatch
    ),
    callHistory: bindActionCreators(actionCreators.callHistory, store.dispatch),
    calling: bindActionCreators(actionCreators.calling, store.dispatch),
    chatFolders: bindActionCreators(actionCreators.chatFolders, store.dispatch),
    composer: bindActionCreators(actionCreators.composer, store.dispatch),
    conversations: bindActionCreators(
      actionCreators.conversations,
      store.dispatch
    ),
    crashReports: bindActionCreators(
      actionCreators.crashReports,
      store.dispatch
    ),
    inbox: bindActionCreators(actionCreators.inbox, store.dispatch),
    emojis: bindActionCreators(actionCreators.emojis, store.dispatch),
    expiration: bindActionCreators(actionCreators.expiration, store.dispatch),
    gifs: bindActionCreators(actionCreators.gifs, store.dispatch),
    globalModals: bindActionCreators(
      actionCreators.globalModals,
      store.dispatch
    ),
    items: bindActionCreators(actionCreators.items, store.dispatch),
    lightbox: bindActionCreators(actionCreators.lightbox, store.dispatch),
    linkPreviews: bindActionCreators(
      actionCreators.linkPreviews,
      store.dispatch
    ),
    mediaGallery: bindActionCreators(
      actionCreators.mediaGallery,
      store.dispatch
    ),
    nav: bindActionCreators(actionCreators.nav, store.dispatch),
    network: bindActionCreators(actionCreators.network, store.dispatch),
    notificationProfiles: bindActionCreators(
      actionCreators.notificationProfiles,
      store.dispatch
    ),
    safetyNumber: bindActionCreators(
      actionCreators.safetyNumber,
      store.dispatch
    ),
    search: bindActionCreators(actionCreators.search, store.dispatch),
    stickers: bindActionCreators(actionCreators.stickers, store.dispatch), // Stub only
    stories: bindActionCreators(actionCreators.stories, store.dispatch), // Stub only
    storyDistributionLists: bindActionCreators(
      actionCreators.storyDistributionLists,
      store.dispatch
    ), // Stub only
    toast: bindActionCreators(actionCreators.toast, store.dispatch),
    updates: bindActionCreators(actionCreators.updates, store.dispatch),
    user: bindActionCreators(actionCreators.user, store.dispatch),
    username: bindActionCreators(actionCreators.username, store.dispatch),
  };
}
