// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { actions as audioPlayer } from './ducks/audioPlayer';
import { actions as calling } from './ducks/calling';
import { actions as conversations } from './ducks/conversations';
import { actions as emojis } from './ducks/emojis';
import { actions as expiration } from './ducks/expiration';
import { actions as globalModals } from './ducks/globalModals';
import { actions as items } from './ducks/items';
import { actions as linkPreviews } from './ducks/linkPreviews';
import { actions as network } from './ducks/network';
import { actions as safetyNumber } from './ducks/safetyNumber';
import { actions as search } from './ducks/search';
import { actions as stickers } from './ducks/stickers';
import { actions as updates } from './ducks/updates';
import { actions as user } from './ducks/user';

export const mapDispatchToProps = {
  ...audioPlayer,
  ...calling,
  ...conversations,
  ...emojis,
  ...expiration,
  ...globalModals,
  ...items,
  ...linkPreviews,
  ...network,
  ...safetyNumber,
  ...search,
  ...stickers,
  ...updates,
  ...user,
};
