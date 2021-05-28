// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartGlobalModalContainer } from '../smart/GlobalModalContainer';

export const createGlobalModalContainer = (
  store: Store
): React.ReactElement => (
  <Provider store={store}>
    <SmartGlobalModalContainer />
  </Provider>
);
