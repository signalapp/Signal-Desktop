// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartApp } from '../smart/App';
import { SmartVoiceNotesPlaybackProvider } from '../smart/VoiceNotesPlaybackProvider';

export const createApp = (store: Store): ReactElement => (
  <Provider store={store}>
    <SmartVoiceNotesPlaybackProvider>
      <SmartApp />
    </SmartVoiceNotesPlaybackProvider>
  </Provider>
);
