// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { ExternalProps } from '../smart/StickerPreviewModal';
import { SmartStickerPreviewModal } from '../smart/StickerPreviewModal';

export const createStickerPreviewModal = (
  store: Store,
  props: ExternalProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartStickerPreviewModal {...props} />
  </Provider>
);
