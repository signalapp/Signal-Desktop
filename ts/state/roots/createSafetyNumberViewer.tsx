// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartSafetyNumberViewer } from '../smart/SafetyNumberViewer';

type Props = {
  contactID: string;
  onClose?: () => void;
};

export const createSafetyNumberViewer = (
  store: Store,
  props: Props
): React.ReactElement => (
  <Provider store={store}>
    <SmartSafetyNumberViewer {...props} />
  </Provider>
);
