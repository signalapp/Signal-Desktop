// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartApp } from '../smart/App.preload.tsx';
import { SmartVoiceNotesPlaybackProvider } from '../smart/VoiceNotesPlaybackProvider.preload.tsx';
import { AppProvider } from '../../windows/AppProvider.dom.tsx';

export const createApp = (store: Store): ReactElement => (
  <AppProvider>
    <Provider store={store}>
      <SmartVoiceNotesPlaybackProvider>
        <SmartApp />
      </SmartVoiceNotesPlaybackProvider>
    </Provider>
  </AppProvider>
);
