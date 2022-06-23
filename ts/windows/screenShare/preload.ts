// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../shims';

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

import { SignalContext } from '../context';
import { CallingScreenSharingController } from '../../components/CallingScreenSharingController';

contextBridge.exposeInMainWorld('SignalContext', SignalContext);

function renderScreenSharingController(presentedSourceName: string): void {
  ReactDOM.render(
    React.createElement(CallingScreenSharingController, {
      platform: process.platform,
      executeMenuRole: SignalContext.executeMenuRole,
      i18n: SignalContext.i18n,
      onCloseController: () => SignalContext.executeMenuRole('close'),
      onStopSharing: () => ipcRenderer.send('stop-screen-share'),
      presentedSourceName,
    }),
    document.getElementById('app')
  );
}

ipcRenderer.once('render-screen-sharing-controller', (_, name: string) => {
  renderScreenSharingController(name);
});
