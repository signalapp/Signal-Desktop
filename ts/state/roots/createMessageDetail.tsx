// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { OwnProps } from '../smart/MessageDetail';
import { SmartMessageDetail } from '../smart/MessageDetail';

export const createMessageDetail = (
  store: Store,
  props: OwnProps
): ReactElement => (
  <Provider store={store}>
    <SmartMessageDetail {...props} />
  </Provider>
);
