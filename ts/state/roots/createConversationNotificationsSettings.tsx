// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartConversationNotificationsSettings,
  OwnProps,
} from '../smart/ConversationNotificationsSettings';

export const createConversationNotificationsSettings = (
  store: Store,
  props: OwnProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartConversationNotificationsSettings {...props} />
  </Provider>
);
