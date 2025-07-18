// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { CallingScreenSharingController } from '../../components/CallingScreenSharingController';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { parseEnvironment, setEnvironment } from '../../environment';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider';

const { ScreenShareWindowProps } = window.Signal;

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
    </StrictMode>
  );
}
render();
ScreenShareWindowProps.setRenderCallback(render);
