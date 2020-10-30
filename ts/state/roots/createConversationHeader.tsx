// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Store } from 'redux';
import { Provider } from 'react-redux';

import { SmartConversationHeader, OwnProps } from '../smart/ConversationHeader';

export const createConversationHeader = (
  store: Store,
  props: OwnProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartConversationHeader {...props} />
  </Provider>
);
