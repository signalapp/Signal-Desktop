// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Selector } from 'reselect';
import type { ThunkAction } from 'redux-thunk';
import type { Action } from 'redux';
import type { StateType } from './reducer.preload.ts';
import type { actions as accounts } from './ducks/accounts.preload.ts';
import type { actions as app } from './ducks/app.preload.ts';
import type { actions as audioPlayer } from './ducks/audioPlayer.preload.ts';
import type { actions as audioRecorder } from './ducks/audioRecorder.preload.ts';
import type { actions as backups } from './ducks/backups.preload.ts';
import type { actions as badges } from './ducks/badges.preload.ts';
import type { actions as callHistory } from './ducks/callHistory.preload.ts';
import type { actions as calling } from './ducks/calling.preload.ts';
import type { actions as chatFolders } from './ducks/chatFolders.preload.ts';
import type { actions as composer } from './ducks/composer.preload.ts';
import type { actions as conversations } from './ducks/conversations.preload.ts';
import type { actions as crashReports } from './ducks/crashReports.preload.ts';
import type { actions as donations } from './ducks/donations.preload.ts';
import type { actions as emojis } from './ducks/emojis.preload.ts';
import type { actions as expiration } from './ducks/expiration.std.ts';
import type { actions as gifs } from './ducks/gifs.preload.ts';
import type { actions as globalModals } from './ducks/globalModals.preload.ts';
import type { actions as inbox } from './ducks/inbox.std.ts';
import type { actions as installer } from './ducks/installer.preload.ts';
import type { actions as items } from './ducks/items.preload.ts';
import type { actions as lightbox } from './ducks/lightbox.preload.ts';
import type { actions as linkPreviews } from './ducks/linkPreviews.preload.ts';
import type { actions as mediaGallery } from './ducks/mediaGallery.preload.ts';
import type { actions as megaphones } from './ducks/megaphones.preload.ts';
import type { actions as nav } from './ducks/nav.std.ts';
import type { actions as network } from './ducks/network.dom.ts';
import type { actions as notificationProfiles } from './ducks/notificationProfiles.preload.ts';
import type { actions as safetyNumber } from './ducks/safetyNumber.preload.ts';
import type { actions as search } from './ducks/search.preload.ts';
import type { actions as stickers } from './ducks/stickers.preload.ts';
import type { actions as stories } from './ducks/stories.preload.ts';
import type { actions as storyDistributionLists } from './ducks/storyDistributionLists.preload.ts';
import type { actions as toast } from './ducks/toast.preload.ts';
import type { actions as updates } from './ducks/updates.preload.ts';
import type { actions as user } from './ducks/user.preload.ts';
import type { actions as username } from './ducks/username.preload.ts';

export type ReduxActions = {
  accounts: typeof accounts;
  app: typeof app;
  audioPlayer: typeof audioPlayer;
  audioRecorder: typeof audioRecorder;
  backups: typeof backups;
  badges: typeof badges;
  callHistory: typeof callHistory;
  calling: typeof calling;
  chatFolders: typeof chatFolders;
  composer: typeof composer;
  conversations: typeof conversations;
  crashReports: typeof crashReports;
  donations: typeof donations;
  emojis: typeof emojis;
  expiration: typeof expiration;
  gifs: typeof gifs;
  globalModals: typeof globalModals;
  inbox: typeof inbox;
  installer: typeof installer;
  items: typeof items;
  lightbox: typeof lightbox;
  linkPreviews: typeof linkPreviews;
  mediaGallery: typeof mediaGallery;
  megaphones: typeof megaphones;
  nav: typeof nav;
  network: typeof network;
  notificationProfiles: typeof notificationProfiles;
  safetyNumber: typeof safetyNumber;
  search: typeof search;
  stickers: typeof stickers;
  stories: typeof stories;
  storyDistributionLists: typeof storyDistributionLists;
  toast: typeof toast;
  updates: typeof updates;
  user: typeof user;
  username: typeof username;
};

export type StateSelector<T> = Selector<StateType, T>;
export type StateThunk<A extends Action = never> = ThunkAction<
  void,
  StateType,
  unknown,
  A
>;
