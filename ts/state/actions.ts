// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { actions as accounts } from './ducks/accounts.js';
import { actions as app } from './ducks/app.js';
import { actions as audioPlayer } from './ducks/audioPlayer.js';
import { actions as audioRecorder } from './ducks/audioRecorder.js';
import { actions as badges } from './ducks/badges.js';
import { actions as callHistory } from './ducks/callHistory.js';
import { actions as calling } from './ducks/calling.js';
import { actions as chatFolders } from './ducks/chatFolders.js';
import { actions as composer } from './ducks/composer.js';
import { actions as conversations } from './ducks/conversations.js';
import { actions as crashReports } from './ducks/crashReports.js';
import { actions as donations } from './ducks/donations.js';
import { actions as emojis } from './ducks/emojis.js';
import { actions as expiration } from './ducks/expiration.js';
import { actions as gifs } from './ducks/gifs.js';
import { actions as globalModals } from './ducks/globalModals.js';
import { actions as inbox } from './ducks/inbox.js';
import { actions as installer } from './ducks/installer.js';
import { actions as items } from './ducks/items.js';
import { actions as lightbox } from './ducks/lightbox.js';
import { actions as linkPreviews } from './ducks/linkPreviews.js';
import { actions as mediaGallery } from './ducks/mediaGallery.js';
import { actions as nav } from './ducks/nav.js';
import { actions as network } from './ducks/network.js';
import { actions as notificationProfiles } from './ducks/notificationProfiles.js';
import { actions as safetyNumber } from './ducks/safetyNumber.js';
import { actions as search } from './ducks/search.js';
import { actions as stickers } from './ducks/stickers.js';
import { actions as stories } from './ducks/stories.js';
import { actions as storyDistributionLists } from './ducks/storyDistributionLists.js';
import { actions as toast } from './ducks/toast.js';
import { actions as updates } from './ducks/updates.js';
import { actions as user } from './ducks/user.js';
import { actions as username } from './ducks/username.js';
import type { ReduxActions } from './types.js';

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
