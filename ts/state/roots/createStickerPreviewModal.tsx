import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartStickerPreviewModal } from '../smart/StickerPreviewModal';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredStickerPreviewModal = SmartStickerPreviewModal as any;

export const createStickerPreviewModal = (store: Store, props: Object) => (
  <Provider store={store}>
    <FilteredStickerPreviewModal {...props} />
  </Provider>
);
