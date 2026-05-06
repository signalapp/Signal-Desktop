// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// TODO DESKTOP-4761

import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import type { Store } from 'redux';
import { ModalHost } from '../../components/ModalHost.dom.tsx';
import type { SmartGroupV2JoinDialogProps } from '../smart/GroupV2JoinDialog.dom.tsx';
import { SmartGroupV2JoinDialog } from '../smart/GroupV2JoinDialog.dom.tsx';
import { AppProvider } from '../../windows/AppProvider.dom.tsx';

export const createGroupV2JoinModal = (
  store: Store,
  props: SmartGroupV2JoinDialogProps
): ReactElement => {
  const { onClose } = props;

  return (
    <AppProvider>
      <Provider store={store}>
        <ModalHost modalName="createGroupV2JoinModal" onClose={onClose}>
          <SmartGroupV2JoinDialog {...props} />
        </ModalHost>
      </Provider>
    </AppProvider>
  );
};
