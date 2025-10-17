// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ClearingData } from '../components/ClearingData.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { deleteAllData } from './deleteAllData.preload.js';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider.dom.js';
import { AxoProvider } from '../axo/AxoProvider.dom.js';

export function renderClearingDataView(): void {
  const appContainer = document.getElementById('app-container');
  strictAssert(appContainer != null, 'No #app-container');
  createRoot(appContainer).render(
    <StrictMode>
      <AxoProvider dir={window.SignalContext.i18n.getLocaleDirection()}>
        <FunDefaultEnglishEmojiLocalizationProvider>
          <ClearingData
            deleteAllData={deleteAllData}
            i18n={window.SignalContext.i18n}
          />
        </FunDefaultEnglishEmojiLocalizationProvider>
      </AxoProvider>
    </StrictMode>
  );
}
