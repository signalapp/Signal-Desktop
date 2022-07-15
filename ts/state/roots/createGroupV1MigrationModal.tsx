// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import type { PropsType } from '../smart/GroupV1MigrationDialog';
import { SmartGroupV1MigrationDialog } from '../smart/GroupV1MigrationDialog';

export const createGroupV1MigrationModal = (
  store: Store,
  props: PropsType
): React.ReactElement => {
  return (
    <Provider store={store}>
      <SmartGroupV1MigrationDialog {...props} />
    </Provider>
  );
};
