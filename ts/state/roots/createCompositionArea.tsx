// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartCompositionArea } from '../smart/CompositionArea';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredCompositionArea = SmartCompositionArea as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createCompositionArea = (
  store: Store,
  props: Record<string, unknown>
): React.ReactElement => (
  <Provider store={store}>
    <FilteredCompositionArea {...props} />
  </Provider>
);
