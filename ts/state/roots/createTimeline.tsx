import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartTimeline } from '../smart/Timeline';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredTimeline = SmartTimeline as any;

export const createTimeline = (store: Store, props: Object) => (
  <Provider store={store}>
    <FilteredTimeline {...props} />
  </Provider>
);
