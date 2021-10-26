// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { SmartChatColorPickerProps } from '../smart/ChatColorPicker';
import { SmartChatColorPicker } from '../smart/ChatColorPicker';

export const createChatColorPicker = (
  store: Store,
  props: SmartChatColorPickerProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartChatColorPicker {...props} />
  </Provider>
);
