// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createStore } from 'redux';
import { reducer } from './reducer';

import * as stickersDuck from './ducks/stickers';

export { stickersDuck };

export const store = createStore(reducer);
