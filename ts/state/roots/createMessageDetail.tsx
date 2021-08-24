// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartMessageDetail, OwnProps } from '../smart/MessageDetail';

export const createMessageDetail = (
  store: Store,
  props: OwnProps
): ReactElement => (
  <Provider store={store}>
    <SmartMessageDetail {...props} />
  </Provider>
);
