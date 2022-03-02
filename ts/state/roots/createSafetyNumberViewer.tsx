// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { SmartSafetyNumberViewer } from '../smart/SafetyNumberViewer';

export const createSafetyNumberViewer = (
  store: Store,
  props: SafetyNumberProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartSafetyNumberViewer {...props} />
  </Provider>
);
