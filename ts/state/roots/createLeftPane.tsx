import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartLeftPane } from '../smart/LeftPane';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredLeftPane = SmartLeftPane as any;

export const createLeftPane = (store: Store) => (
  <Provider store={store as any}>
    <FilteredLeftPane />
  </Provider>
);
