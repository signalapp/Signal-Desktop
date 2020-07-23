import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartSessionConversation } from '../smart/SessionConversation';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSessionConversation = SmartSessionConversation as any;

export const createSessionConversation = (store: Store) => (
  <Provider store={store as any}>
    <FilteredSessionConversation />
  </Provider>
);
