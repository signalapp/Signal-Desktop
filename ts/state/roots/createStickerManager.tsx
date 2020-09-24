import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartStickerManager } from '../smart/StickerManager';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredStickerManager = SmartStickerManager as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createStickerManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <FilteredStickerManager />
  </Provider>
);
