// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartSafetyNumberViewer } from '../smart/SafetyNumberViewer';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSafetyNumberViewer = SmartSafetyNumberViewer as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

type Props = {
  contactID: string;
  onClose?: () => void;
};

export const createSafetyNumberViewer = (
  store: Store,
  props: Props
): React.ReactElement => (
  <Provider store={store}>
    <FilteredSafetyNumberViewer {...props} />
  </Provider>
);
