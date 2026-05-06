// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.dom.ts';
import { CallingScreenSharingController } from '../../components/CallingScreenSharingController.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { drop } from '../../util/drop.std.ts';
import { parseEnvironment, setEnvironment } from '../../environment.std.ts';
import { AppProvider } from '../AppProvider.dom.tsx';

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
    <AppProvider>
      <div className="App dark-theme">
        <CallingScreenSharingController
          i18n={i18n}
          onCloseController={onCloseController}
          onStopSharing={ScreenShareWindowProps.onStopSharing}
          status={ScreenShareWindowProps.getStatus()}
          presentedSourceName={ScreenShareWindowProps.presentedSourceName}
        />
      </div>
    </AppProvider>
  );
}
render();
ScreenShareWindowProps.setRenderCallback(render);
