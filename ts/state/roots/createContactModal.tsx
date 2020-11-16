// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartContactModal,
  SmartContactModalProps,
} from '../smart/ContactModal';

export const createContactModal = (
  store: Store,
  props: SmartContactModalProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartContactModal {...props} />
  </Provider>
);
