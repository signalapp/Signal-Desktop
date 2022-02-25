// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { PropsType } from '../smart/ConversationView';
import { SmartConversationView } from '../smart/ConversationView';

export const createConversationView = (
  store: Store,
  props: PropsType
): React.ReactElement => (
  <Provider store={store}>
    <SmartConversationView {...props} />
  </Provider>
);
