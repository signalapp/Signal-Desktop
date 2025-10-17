// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { combineReducers } from 'redux';

import { reducer as accounts } from './ducks/accounts.preload.js';
import { reducer as app } from './ducks/app.preload.js';
import { reducer as audioPlayer } from './ducks/audioPlayer.preload.js';
import { reducer as audioRecorder } from './ducks/audioRecorder.preload.js';
import { reducer as badges } from './ducks/badges.preload.js';
import { reducer as calling } from './ducks/calling.preload.js';
import { reducer as callHistory } from './ducks/callHistory.preload.js';
import { reducer as chatFolders } from './ducks/chatFolders.preload.js';
import { reducer as composer } from './ducks/composer.preload.js';
import { reducer as conversations } from './ducks/conversations.preload.js';
import { reducer as crashReports } from './ducks/crashReports.preload.js';
import { reducer as donations } from './ducks/donations.preload.js';
import { reducer as emojis } from './ducks/emojis.preload.js';
import { reducer as expiration } from './ducks/expiration.std.js';
import { reducer as gifs } from './ducks/gifs.preload.js';
import { reducer as globalModals } from './ducks/globalModals.preload.js';
import { reducer as inbox } from './ducks/inbox.std.js';
import { reducer as installer } from './ducks/installer.preload.js';
import { reducer as items } from './ducks/items.preload.js';
import { reducer as lightbox } from './ducks/lightbox.preload.js';
import { reducer as linkPreviews } from './ducks/linkPreviews.preload.js';
import { reducer as mediaGallery } from './ducks/mediaGallery.preload.js';
import { reducer as nav } from './ducks/nav.std.js';
import { reducer as network } from './ducks/network.dom.js';
import { reducer as notificationProfiles } from './ducks/notificationProfiles.preload.js';
import { reducer as preferredReactions } from './ducks/preferredReactions.preload.js';
import { reducer as safetyNumber } from './ducks/safetyNumber.preload.js';
import { reducer as search } from './ducks/search.preload.js';
import { reducer as stickers } from './ducks/stickers.preload.js';
import { reducer as stories } from './ducks/stories.preload.js';
import { reducer as storyDistributionLists } from './ducks/storyDistributionLists.preload.js';
import { reducer as toast } from './ducks/toast.preload.js';
import { reducer as updates } from './ducks/updates.preload.js';
import { reducer as user } from './ducks/user.preload.js';
import { reducer as username } from './ducks/username.preload.js';

export const reducer = combineReducers({
  accounts,
  app,
  audioPlayer,
  audioRecorder,
  badges,
  calling,
  callHistory,
  chatFolders,
  composer,
  conversations,
  crashReports,
  donations,
  emojis,
  expiration,
  gifs,
  globalModals,
  inbox,
  installer,
  items,
  lightbox,
  linkPreviews,
  mediaGallery,
  nav,
  network,
  notificationProfiles,
  preferredReactions,
  safetyNumber,
  search,
  stickers,
  stories,
  storyDistributionLists,
  toast,
  updates,
  user,
  username,
});

export type StateType = ReturnType<typeof reducer>;
