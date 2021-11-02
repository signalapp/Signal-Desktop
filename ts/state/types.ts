// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { actions as accounts } from './ducks/accounts';
import type { actions as app } from './ducks/app';
import type { actions as audioPlayer } from './ducks/audioPlayer';
import type { actions as audioRecorder } from './ducks/audioRecorder';
import type { actions as badges } from './ducks/badges';
import type { actions as calling } from './ducks/calling';
import type { actions as composer } from './ducks/composer';
import type { actions as conversations } from './ducks/conversations';
import type { actions as emojis } from './ducks/emojis';
import type { actions as expiration } from './ducks/expiration';
import type { actions as globalModals } from './ducks/globalModals';
import type { actions as items } from './ducks/items';
import type { actions as linkPreviews } from './ducks/linkPreviews';
import type { actions as network } from './ducks/network';
import type { actions as safetyNumber } from './ducks/safetyNumber';
import type { actions as search } from './ducks/search';
import type { actions as stickers } from './ducks/stickers';
import type { actions as updates } from './ducks/updates';
import type { actions as user } from './ducks/user';

export type ReduxActions = {
  accounts: typeof accounts;
  app: typeof app;
  audioPlayer: typeof audioPlayer;
  audioRecorder: typeof audioRecorder;
  badges: typeof badges;
  calling: typeof calling;
  composer: typeof composer;
  conversations: typeof conversations;
  emojis: typeof emojis;
  expiration: typeof expiration;
  globalModals: typeof globalModals;
  items: typeof items;
  linkPreviews: typeof linkPreviews;
  network: typeof network;
  safetyNumber: typeof safetyNumber;
  search: typeof search;
  stickers: typeof stickers;
  updates: typeof updates;
  user: typeof user;
};
