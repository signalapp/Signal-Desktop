import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartEmojiButton } from '../smart/EmojiButton';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredEmojiButton = SmartEmojiButton as any;

export const createEmojiButton = (store: Store, props: Object) => (
  <Provider store={store}>
    <FilteredEmojiButton {...props} />
  </Provider>
);
