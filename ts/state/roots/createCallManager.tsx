// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartCallManager } from '../smart/CallManager';

export const createCallManager = (store: Store): React.ReactElement => (
  <Provider store={store}>
    <SmartCallManager />
  </Provider>
);
