// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartChatColorPicker,
  SmartChatColorPickerProps,
} from '../smart/ChatColorPicker';

export const createChatColorPicker = (
  store: Store,
  props: SmartChatColorPickerProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartChatColorPicker {...props} />
  </Provider>
);
