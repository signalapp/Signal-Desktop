import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartCallManager } from '../smart/CallManager';

export const createCallManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <SmartCallManager />
  </Provider>
);
