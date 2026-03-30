// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { combineReducers } from 'redux';

import { reducer as accounts } from './ducks/accounts.preload.ts';
import { reducer as app } from './ducks/app.preload.ts';
import { reducer as audioPlayer } from './ducks/audioPlayer.preload.ts';
import { reducer as audioRecorder } from './ducks/audioRecorder.preload.ts';
import { reducer as backups } from './ducks/backups.preload.ts';
import { reducer as badges } from './ducks/badges.preload.ts';
import { reducer as calling } from './ducks/calling.preload.ts';
import { reducer as callHistory } from './ducks/callHistory.preload.ts';
import { reducer as chatFolders } from './ducks/chatFolders.preload.ts';
import { reducer as composer } from './ducks/composer.preload.ts';
import { reducer as conversations } from './ducks/conversations.preload.ts';
import { reducer as crashReports } from './ducks/crashReports.preload.ts';
import { reducer as donations } from './ducks/donations.preload.ts';
import { reducer as emojis } from './ducks/emojis.preload.ts';
import { reducer as expiration } from './ducks/expiration.std.ts';
import { reducer as gifs } from './ducks/gifs.preload.ts';
import { reducer as globalModals } from './ducks/globalModals.preload.ts';
import { reducer as inbox } from './ducks/inbox.std.ts';
import { reducer as installer } from './ducks/installer.preload.ts';
import { reducer as items } from './ducks/items.preload.ts';
import { reducer as lightbox } from './ducks/lightbox.preload.ts';
import { reducer as linkPreviews } from './ducks/linkPreviews.preload.ts';
import { reducer as mediaGallery } from './ducks/mediaGallery.preload.ts';
import { reducer as megaphones } from './ducks/megaphones.preload.ts';
import { reducer as nav } from './ducks/nav.std.ts';
import { reducer as network } from './ducks/network.dom.ts';
import { reducer as notificationProfiles } from './ducks/notificationProfiles.preload.ts';
import { reducer as preferredReactions } from './ducks/preferredReactions.preload.ts';
import { reducer as safetyNumber } from './ducks/safetyNumber.preload.ts';
import { reducer as search } from './ducks/search.preload.ts';
import { reducer as stickers } from './ducks/stickers.preload.ts';
import { reducer as stories } from './ducks/stories.preload.ts';
import { reducer as storyDistributionLists } from './ducks/storyDistributionLists.preload.ts';
import { reducer as toast } from './ducks/toast.preload.ts';
import { reducer as updates } from './ducks/updates.preload.ts';
import { reducer as user } from './ducks/user.preload.ts';
import { reducer as username } from './ducks/username.preload.ts';

export const reducer = combineReducers({
  accounts,
  app,
  audioPlayer,
  audioRecorder,
  backups,
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
  megaphones,
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
