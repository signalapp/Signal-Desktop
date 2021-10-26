// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartStickerManager } from '../smart/StickerManager';

export const createStickerManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <SmartStickerManager />
  </Provider>
);
