// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { ModalHost } from '../../components/ModalHost';
import type { PropsType } from '../smart/GroupV1MigrationDialog';
import { SmartGroupV1MigrationDialog } from '../smart/GroupV1MigrationDialog';

export const createGroupV1MigrationModal = (
  store: Store,
  props: PropsType
): React.ReactElement => {
  const { onClose } = props;

  return (
    <Provider store={store}>
      <ModalHost onClose={onClose}>
        <SmartGroupV1MigrationDialog {...props} />
      </ModalHost>
    </Provider>
  );
};
