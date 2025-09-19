// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { combineReducers } from 'redux';

import { reducer as accounts } from './ducks/accounts.js';
import { reducer as app } from './ducks/app.js';
import { reducer as audioPlayer } from './ducks/audioPlayer.js';
import { reducer as audioRecorder } from './ducks/audioRecorder.js';
import { reducer as badges } from './ducks/badges.js';
import { reducer as calling } from './ducks/calling.js';
import { reducer as callHistory } from './ducks/callHistory.js';
import { reducer as chatFolders } from './ducks/chatFolders.js';
import { reducer as composer } from './ducks/composer.js';
import { reducer as conversations } from './ducks/conversations.js';
import { reducer as crashReports } from './ducks/crashReports.js';
import { reducer as donations } from './ducks/donations.js';
import { reducer as emojis } from './ducks/emojis.js';
import { reducer as expiration } from './ducks/expiration.js';
import { reducer as gifs } from './ducks/gifs.js';
import { reducer as globalModals } from './ducks/globalModals.js';
import { reducer as inbox } from './ducks/inbox.js';
import { reducer as installer } from './ducks/installer.js';
import { reducer as items } from './ducks/items.js';
import { reducer as lightbox } from './ducks/lightbox.js';
import { reducer as linkPreviews } from './ducks/linkPreviews.js';
import { reducer as mediaGallery } from './ducks/mediaGallery.js';
import { reducer as nav } from './ducks/nav.js';
import { reducer as network } from './ducks/network.js';
import { reducer as notificationProfiles } from './ducks/notificationProfiles.js';
import { reducer as preferredReactions } from './ducks/preferredReactions.js';
import { reducer as safetyNumber } from './ducks/safetyNumber.js';
import { reducer as search } from './ducks/search.js';
import { reducer as stickers } from './ducks/stickers.js';
import { reducer as stories } from './ducks/stories.js';
import { reducer as storyDistributionLists } from './ducks/storyDistributionLists.js';
import { reducer as toast } from './ducks/toast.js';
import { reducer as updates } from './ducks/updates.js';
import { reducer as user } from './ducks/user.js';
import { reducer as username } from './ducks/username.js';

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
