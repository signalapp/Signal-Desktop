// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// TODO DESKTOP-4761

import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { ModalHost } from '../../components/ModalHost.dom.js';
import type { SmartGroupV2JoinDialogProps } from '../smart/GroupV2JoinDialog.dom.js';
import { SmartGroupV2JoinDialog } from '../smart/GroupV2JoinDialog.dom.js';
import { FunEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.dom.js';

export const createGroupV2JoinModal = (
  store: Store,
  props: SmartGroupV2JoinDialogProps
): React.ReactElement => {
  const { onClose } = props;

  return (
    <Provider store={store}>
      <FunEmojiLocalizationProvider i18n={window.SignalContext.i18n}>
        <ModalHost modalName="createGroupV2JoinModal" onClose={onClose}>
          <SmartGroupV2JoinDialog {...props} />
        </ModalHost>
      </FunEmojiLocalizationProvider>
    </Provider>
  );
};
