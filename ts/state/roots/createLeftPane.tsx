import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartLeftPane } from '../smart/LeftPane';

export const createLeftPane = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <SmartLeftPane />
  </Provider>
);
