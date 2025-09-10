// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DebugLogWindow } from '../../components/DebugLogWindow';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';
import { AxoProvider } from '../../axo/AxoProvider';

const { DebugLogWindowProps } = window.Signal;

strictAssert(DebugLogWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <StrictMode>
    <AxoProvider dir={i18n.getLocaleDirection()}>
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
