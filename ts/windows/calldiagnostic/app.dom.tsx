// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSyncExternalStore, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.dom.ts';
import { CallDiagnosticWindow } from '../../components/CallDiagnosticWindow.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AppProvider } from '../AppProvider.dom.tsx';

const { CallDiagnosticWindowProps } = window.Signal;
strictAssert(CallDiagnosticWindowProps, 'window values not provided');
const { subscribe, getSnapshot } = CallDiagnosticWindowProps;
const { i18n } = window.SignalContext;

function App(): JSX.Element | null {
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
  <AppProvider>
    <App />
  </AppProvider>
);
