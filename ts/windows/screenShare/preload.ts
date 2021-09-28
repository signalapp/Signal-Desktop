// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

// It is important to call this as early as possible
import '../context';

import { SignalWindow } from '../configure';
import { CallingScreenSharingController } from '../../components/CallingScreenSharingController';

contextBridge.exposeInMainWorld('SignalWindow', SignalWindow);

function renderScreenSharingController(presentedSourceName: string): void {
  ReactDOM.render(
    React.createElement(CallingScreenSharingController, {
      i18n: SignalWindow.i18n,
      onCloseController: () =>
        ipcRenderer.send('close-screen-share-controller'),
      onStopSharing: () => ipcRenderer.send('stop-screen-share'),
      presentedSourceName,
    }),
    document.getElementById('app')
  );
}

ipcRenderer.once('render-screen-sharing-controller', (_, name: string) => {
  renderScreenSharingController(name);
});
