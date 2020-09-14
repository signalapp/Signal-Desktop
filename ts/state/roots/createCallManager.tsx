import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartCallManager } from '../smart/CallManager';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredCallManager = SmartCallManager as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createCallManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <FilteredCallManager />
  </Provider>
);
