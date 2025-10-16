// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../sandboxedInit.dom.js';
import { CallingScreenSharingController } from '../../components/CallingScreenSharingController.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import { parseEnvironment, setEnvironment } from '../../environment.std.js';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.dom.js';
import { AxoProvider } from '../../axo/AxoProvider.dom.js';

const { ScreenShareWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

strictAssert(ScreenShareWindowProps, 'window values not provided');

setEnvironment(
  parseEnvironment(window.SignalContext.getEnvironment()),
  window.SignalContext.isTestOrMockEnvironment()
);

function onCloseController(): void {
  drop(window.SignalContext.executeMenuRole('close'));
}

function render() {
  // Pacify typescript
  strictAssert(ScreenShareWindowProps, 'window values not provided');

  const app = document.getElementById('app');
  strictAssert(app != null, 'No #app');

  createRoot(app).render(
    <StrictMode>
      <AxoProvider
        dir={window.SignalContext.getResolvedMessagesLocaleDirection()}
      >
        <FunDefaultEnglishEmojiLocalizationProvider>
          <div className="App dark-theme">
            <CallingScreenSharingController
              i18n={i18n}
              onCloseController={onCloseController}
              onStopSharing={ScreenShareWindowProps.onStopSharing}
              status={ScreenShareWindowProps.getStatus()}
              presentedSourceName={ScreenShareWindowProps.presentedSourceName}
            />
          </div>
        </FunDefaultEnglishEmojiLocalizationProvider>
      </AxoProvider>
    </StrictMode>
  );
}
render();
ScreenShareWindowProps.setRenderCallback(render);
