// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.js';
import { DebugLogWindow } from '../../components/DebugLogWindow.js';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.js';
import { strictAssert } from '../../util/assert.js';
import { AxoProvider } from '../../axo/AxoProvider.js';

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
      <FunDefaultEnglishEmojiLocalizationProvider>
        <DebugLogWindow
          closeWindow={() => window.SignalContext.executeMenuRole('close')}
          downloadLog={DebugLogWindowProps.downloadLog}
          i18n={i18n}
          fetchLogs={DebugLogWindowProps.fetchLogs}
          uploadLogs={DebugLogWindowProps.uploadLogs}
        />
      </FunDefaultEnglishEmojiLocalizationProvider>
    </AxoProvider>
  </StrictMode>
);
