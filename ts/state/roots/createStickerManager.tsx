import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartStickerManager } from '../smart/StickerManager';

export const createStickerManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <SmartStickerManager />
  </Provider>
);
