// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartConversationDetails,
  SmartConversationDetailsProps,
} from '../smart/ConversationDetails';

export const createConversationDetails = (
  store: Store,
  props: SmartConversationDetailsProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartConversationDetails {...props} />
  </Provider>
);
