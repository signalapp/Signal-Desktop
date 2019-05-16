import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartStickerButton } from '../smart/StickerButton';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredStickerButton = SmartStickerButton as any;

export const createStickerButton = (store: Store, props: Object) => (
  <Provider store={store}>
    <FilteredStickerButton {...props} />
  </Provider>
);
