// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartForwardMessageModal,
  SmartForwardMessageModalProps,
} from '../smart/ForwardMessageModal';

export const createForwardMessageModal = (
  store: Store,
  props: SmartForwardMessageModalProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartForwardMessageModal {...props} />
  </Provider>
);
