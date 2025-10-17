// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import { Provider } from 'react-redux';

import type { Store } from 'redux';

import { SmartApp } from '../smart/App.preload.js';
import { SmartVoiceNotesPlaybackProvider } from '../smart/VoiceNotesPlaybackProvider.preload.js';
import { AxoProvider } from '../../axo/AxoProvider.dom.js';

export const createApp = (store: Store): ReactElement => (
  <AxoProvider dir={window.SignalContext.i18n.getLocaleDirection()}>
    <Provider store={store}>
      <SmartVoiceNotesPlaybackProvider>
        <SmartApp />
      </SmartVoiceNotesPlaybackProvider>
    </Provider>
  </AxoProvider>
);
