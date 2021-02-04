// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import {
  SmartGroupLinkManagement,
  SmartGroupLinkManagementProps,
} from '../smart/GroupLinkManagement';

export const createGroupLinkManagement = (
  store: Store,
  props: SmartGroupLinkManagementProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartGroupLinkManagement {...props} />
  </Provider>
);
