// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { PropsType } from '../smart/ConversationView';
import { SmartConversationView } from '../smart/ConversationView';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredConversationView = SmartConversationView as any;
/* eslint-disable @typescript-eslint/no-explicit-any */

export const createConversationView = (
  store: Store,
  props: PropsType
): React.ReactElement => (
  <Provider store={store}>
    <FilteredConversationView {...props} />
  </Provider>
);
