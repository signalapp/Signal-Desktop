// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.dom.ts';
import { CallDiagnosticWindow } from '../../components/CallDiagnosticWindow.dom.tsx';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';

const { CallDiagnosticWindowProps } = window.Signal;
strictAssert(CallDiagnosticWindowProps, 'window values not provided');
const { subscribe, getSnapshot } = CallDiagnosticWindowProps;
const { i18n } = window.SignalContext;

function App(): React.JSX.Element | null {
  const diagnosticData = useSyncExternalStore(subscribe, getSnapshot);

  if (diagnosticData == null) {
    return null;
  }

  return (
    <CallDiagnosticWindow
      closeWindow={() => window.SignalContext.executeMenuRole('close')}
      i18n={i18n}
      diagnosticData={diagnosticData}
    />
  );
}

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <StrictMode>
    <AxoProvider
      dir={window.SignalContext.getResolvedMessagesLocaleDirection()}
    >
      <FunDefaultEnglishEmojiLocalizationProvider>
        <App />
      </FunDefaultEnglishEmojiLocalizationProvider>
    </AxoProvider>
  </StrictMode>
);
