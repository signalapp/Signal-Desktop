// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { bindActionCreators } from 'redux';
import { actionCreators } from './actions';
import { createStore } from './createStore';
import { getInitialState } from './getInitialState';

import type { BadgesStateType } from './ducks/badges';
import type { CallHistoryDetails } from '../types/CallDisposition';
import type { MainWindowStatsType } from '../windows/context';
import type { MenuOptionsType } from '../types/menu';
import type { StoryDataType } from './ducks/stories';
import type { StoryDistributionListDataType } from './ducks/storyDistributionLists';
import type { ThemeType } from '../types/Util';
import type { CallLinkType } from '../types/CallLink';
import type { RecentEmojiObjectType } from '../util/loadRecentEmojis';
import type { StickersStateType } from './ducks/stickers';

export type ReduxInitData = {
  badgesState: BadgesStateType;
  callHistory: ReadonlyArray<CallHistoryDetails>;
  callHistoryUnreadCount: number;
  callLinks: ReadonlyArray<CallLinkType>;
  mainWindowStats: MainWindowStatsType;
  menuOptions: MenuOptionsType;
  recentEmoji: RecentEmojiObjectType;
  stickers: StickersStateType;
  stories: Array<StoryDataType>;
  storyDistributionLists: Array<StoryDistributionListDataType>;
  theme: ThemeType;
};

export function initializeRedux(data: ReduxInitData): void {
  const initialState = getInitialState(data);

  const store = createStore(initialState);
  window.reduxStore = store;

  // Binding these actions to our redux store and exposing them allows us to update
  //   redux when things change in the backbone world.
  window.reduxActions = {
    accounts: bindActionCreators(actionCreators.accounts, store.dispatch),
    app: bindActionCreators(actionCreators.app, store.dispatch),
    installer: bindActionCreators(actionCreators.installer, store.dispatch),
    audioPlayer: bindActionCreators(actionCreators.audioPlayer, store.dispatch),
    audioRecorder: bindActionCreators(
      actionCreators.audioRecorder,
      store.dispatch
    ),
    badges: bindActionCreators(actionCreators.badges, store.dispatch),
    callHistory: bindActionCreators(actionCreators.callHistory, store.dispatch),
    calling: bindActionCreators(actionCreators.calling, store.dispatch),
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
    network: bindActionCreators(actionCreators.network, store.dispatch),
    safetyNumber: bindActionCreators(
      actionCreators.safetyNumber,
      store.dispatch
    ),
    search: bindActionCreators(actionCreators.search, store.dispatch),
    stickers: bindActionCreators(actionCreators.stickers, store.dispatch),
    stories: bindActionCreators(actionCreators.stories, store.dispatch),
    storyDistributionLists: bindActionCreators(
      actionCreators.storyDistributionLists,
      store.dispatch
    ),
    toast: bindActionCreators(actionCreators.toast, store.dispatch),
    updates: bindActionCreators(actionCreators.updates, store.dispatch),
    user: bindActionCreators(actionCreators.user, store.dispatch),
    username: bindActionCreators(actionCreators.username, store.dispatch),
  };
}
