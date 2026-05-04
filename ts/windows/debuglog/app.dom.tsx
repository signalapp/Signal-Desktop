// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.dom.ts';
import { DebugLogWindow } from '../../components/DebugLogWindow.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';

const { DebugLogWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

strictAssert(DebugLogWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <StrictMode>
    <AxoProvider
      dir={window.SignalContext.getResolvedMessagesLocaleDirection()}
    >
      <DebugLogWindow
        closeWindow={() => window.SignalContext.executeMenuRole('close')}
        downloadLog={DebugLogWindowProps.downloadLog}
        i18n={i18n}
        fetchLogs={DebugLogWindowProps.fetchLogs}
        uploadLogs={DebugLogWindowProps.uploadLogs}
        mode={DebugLogWindowProps.mode}
      />
    </AxoProvider>
  </StrictMode>
);
