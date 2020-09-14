import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartTimeline } from '../smart/Timeline';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredTimeline = SmartTimeline as any;
/* eslint-disable @typescript-eslint/no-explicit-any */

export const createTimeline = (
  store: Store,
  props: Record<string, unknown>
): React.ReactElement => (
  <Provider store={store}>
    <FilteredTimeline {...props} />
  </Provider>
);
