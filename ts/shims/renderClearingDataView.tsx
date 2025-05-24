// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { render } from 'react-dom';

import { ClearingData } from '../components/ClearingData';
import { deleteAllData } from './deleteAllData';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../components/fun/FunEmojiLocalizationProvider';

export function renderClearingDataView(): void {
  render(
    <StrictMode>
      <FunDefaultEnglishEmojiLocalizationProvider>
        <ClearingData deleteAllData={deleteAllData} i18n={window.i18n} />
      </FunDefaultEnglishEmojiLocalizationProvider>
    </StrictMode>,
    document.getElementById('app-container')
  );
}
