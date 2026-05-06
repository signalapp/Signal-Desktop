// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRoot } from 'react-dom/client';
import { ClearingData } from '../components/ClearingData.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { deleteAllData } from './deleteAllData.preload.ts';
import { AppProvider } from '../windows/AppProvider.dom.tsx';

export function renderClearingDataView(): void {
  const appContainer = document.getElementById('app-container');

  strictAssert(appContainer != null, 'No #app-container');
  createRoot(appContainer).render(
    <AppProvider>
      <ClearingData
        deleteAllData={deleteAllData}
        i18n={window.SignalContext.i18n}
      />
    </AppProvider>
  );
}
