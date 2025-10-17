// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { actions as accounts } from './ducks/accounts.preload.js';
import { actions as app } from './ducks/app.preload.js';
import { actions as audioPlayer } from './ducks/audioPlayer.preload.js';
import { actions as audioRecorder } from './ducks/audioRecorder.preload.js';
import { actions as badges } from './ducks/badges.preload.js';
import { actions as callHistory } from './ducks/callHistory.preload.js';
import { actions as calling } from './ducks/calling.preload.js';
import { actions as chatFolders } from './ducks/chatFolders.preload.js';
import { actions as composer } from './ducks/composer.preload.js';
import { actions as conversations } from './ducks/conversations.preload.js';
import { actions as crashReports } from './ducks/crashReports.preload.js';
import { actions as donations } from './ducks/donations.preload.js';
import { actions as emojis } from './ducks/emojis.preload.js';
import { actions as expiration } from './ducks/expiration.std.js';
import { actions as gifs } from './ducks/gifs.preload.js';
import { actions as globalModals } from './ducks/globalModals.preload.js';
import { actions as inbox } from './ducks/inbox.std.js';
import { actions as installer } from './ducks/installer.preload.js';
import { actions as items } from './ducks/items.preload.js';
import { actions as lightbox } from './ducks/lightbox.preload.js';
import { actions as linkPreviews } from './ducks/linkPreviews.preload.js';
import { actions as mediaGallery } from './ducks/mediaGallery.preload.js';
import { actions as nav } from './ducks/nav.std.js';
import { actions as network } from './ducks/network.dom.js';
import { actions as notificationProfiles } from './ducks/notificationProfiles.preload.js';
import { actions as safetyNumber } from './ducks/safetyNumber.preload.js';
import { actions as search } from './ducks/search.preload.js';
import { actions as stickers } from './ducks/stickers.preload.js';
import { actions as stories } from './ducks/stories.preload.js';
import { actions as storyDistributionLists } from './ducks/storyDistributionLists.preload.js';
import { actions as toast } from './ducks/toast.preload.js';
import { actions as updates } from './ducks/updates.preload.js';
import { actions as user } from './ducks/user.preload.js';
import { actions as username } from './ducks/username.preload.js';
import type { ReduxActions } from './types.std.js';

export const actionCreators: ReduxActions = {
  accounts,
  app,
  audioPlayer,
  audioRecorder,
  badges,
  callHistory,
  calling,
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
  safetyNumber,
  search,
  stickers,
  stories,
  storyDistributionLists,
  toast,
  updates,
  user,
  username,
};
