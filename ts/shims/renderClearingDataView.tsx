// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ClearingData } from '../components/ClearingData';
import { strictAssert } from '../util/assert';
import { deleteAllData } from './deleteAllData';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider';
import { AxoProvider } from '../axo/AxoProvider';

export function renderClearingDataView(): void {
  const appContainer = document.getElementById('app-container');
  strictAssert(appContainer != null, 'No #app-container');
  createRoot(appContainer).render(
    <StrictMode>
      <AxoProvider dir={window.i18n.getLocaleDirection()}>
        <FunDefaultEnglishEmojiLocalizationProvider>
          <ClearingData deleteAllData={deleteAllData} i18n={window.i18n} />
        </FunDefaultEnglishEmojiLocalizationProvider>
      </AxoProvider>
    </StrictMode>
  );
}
