// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { SmartGroupV2PermissionsProps } from '../smart/GroupV2Permissions';
import { SmartGroupV2Permissions } from '../smart/GroupV2Permissions';

export const createGroupV2Permissions = (
  store: Store,
  props: SmartGroupV2PermissionsProps
): React.ReactElement => (
  <Provider store={store}>
    <SmartGroupV2Permissions {...props} />
  </Provider>
);
