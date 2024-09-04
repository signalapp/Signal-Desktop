// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { actions as accounts } from './ducks/accounts';
import { actions as app } from './ducks/app';
import { actions as audioPlayer } from './ducks/audioPlayer';
import { actions as audioRecorder } from './ducks/audioRecorder';
import { actions as badges } from './ducks/badges';
import { actions as callHistory } from './ducks/callHistory';
import { actions as calling } from './ducks/calling';
import { actions as composer } from './ducks/composer';
import { actions as conversations } from './ducks/conversations';
import { actions as crashReports } from './ducks/crashReports';
import { actions as emojis } from './ducks/emojis';
import { actions as expiration } from './ducks/expiration';
import { actions as globalModals } from './ducks/globalModals';
import { actions as inbox } from './ducks/inbox';
import { actions as installer } from './ducks/installer';
import { actions as items } from './ducks/items';
import { actions as lightbox } from './ducks/lightbox';
import { actions as linkPreviews } from './ducks/linkPreviews';
import { actions as mediaGallery } from './ducks/mediaGallery';
import { actions as network } from './ducks/network';
import { actions as safetyNumber } from './ducks/safetyNumber';
import { actions as search } from './ducks/search';
import { actions as stickers } from './ducks/stickers';
import { actions as stories } from './ducks/stories';
import { actions as storyDistributionLists } from './ducks/storyDistributionLists';
import { actions as toast } from './ducks/toast';
import { actions as updates } from './ducks/updates';
import { actions as user } from './ducks/user';
import { actions as username } from './ducks/username';
import type { ReduxActions } from './types';

export const actionCreators: ReduxActions = {
  accounts,
  app,
  audioPlayer,
  audioRecorder,
  badges,
  callHistory,
  calling,
  composer,
  conversations,
  crashReports,
  emojis,
  expiration,
  globalModals,
  inbox,
  installer,
  items,
  lightbox,
  linkPreviews,
  mediaGallery,
  network,
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
