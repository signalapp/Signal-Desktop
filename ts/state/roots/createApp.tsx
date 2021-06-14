// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartApp } from '../smart/App';

export const createApp = (store: Store): ReactElement => (
  <Provider store={store}>
    <SmartApp />
  </Provider>
);
