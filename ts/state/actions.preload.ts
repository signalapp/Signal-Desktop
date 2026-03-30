// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { actions as accounts } from './ducks/accounts.preload.ts';
import { actions as app } from './ducks/app.preload.ts';
import { actions as audioPlayer } from './ducks/audioPlayer.preload.ts';
import { actions as audioRecorder } from './ducks/audioRecorder.preload.ts';
import { actions as backups } from './ducks/backups.preload.ts';
import { actions as badges } from './ducks/badges.preload.ts';
import { actions as callHistory } from './ducks/callHistory.preload.ts';
import { actions as calling } from './ducks/calling.preload.ts';
import { actions as chatFolders } from './ducks/chatFolders.preload.ts';
import { actions as composer } from './ducks/composer.preload.ts';
import { actions as conversations } from './ducks/conversations.preload.ts';
import { actions as crashReports } from './ducks/crashReports.preload.ts';
import { actions as donations } from './ducks/donations.preload.ts';
import { actions as emojis } from './ducks/emojis.preload.ts';
import { actions as expiration } from './ducks/expiration.std.ts';
import { actions as gifs } from './ducks/gifs.preload.ts';
import { actions as globalModals } from './ducks/globalModals.preload.ts';
import { actions as inbox } from './ducks/inbox.std.ts';
import { actions as installer } from './ducks/installer.preload.ts';
import { actions as items } from './ducks/items.preload.ts';
import { actions as lightbox } from './ducks/lightbox.preload.ts';
import { actions as linkPreviews } from './ducks/linkPreviews.preload.ts';
import { actions as mediaGallery } from './ducks/mediaGallery.preload.ts';
import { actions as megaphones } from './ducks/megaphones.preload.ts';
import { actions as nav } from './ducks/nav.std.ts';
import { actions as network } from './ducks/network.dom.ts';
import { actions as notificationProfiles } from './ducks/notificationProfiles.preload.ts';
import { actions as safetyNumber } from './ducks/safetyNumber.preload.ts';
import { actions as search } from './ducks/search.preload.ts';
import { actions as stickers } from './ducks/stickers.preload.ts';
import { actions as stories } from './ducks/stories.preload.ts';
import { actions as storyDistributionLists } from './ducks/storyDistributionLists.preload.ts';
import { actions as toast } from './ducks/toast.preload.ts';
import { actions as updates } from './ducks/updates.preload.ts';
import { actions as user } from './ducks/user.preload.ts';
import { actions as username } from './ducks/username.preload.ts';
import type { ReduxActions } from './types.std.ts';

export const actionCreators: ReduxActions = {
  accounts,
  app,
  audioPlayer,
  audioRecorder,
  backups,
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
  megaphones,
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
