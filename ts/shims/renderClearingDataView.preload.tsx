// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ClearingData } from '../components/ClearingData.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { deleteAllData } from './deleteAllData.preload.ts';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider.dom.tsx';
import { AxoProvider } from '../axo/AxoProvider.dom.tsx';

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
