import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartCompositionArea } from '../smart/CompositionArea';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredCompositionArea = SmartCompositionArea as any;

export const createCompositionArea = (store: Store, props: Object) => (
  <Provider store={store}>
    <FilteredCompositionArea {...props} />
  </Provider>
);
