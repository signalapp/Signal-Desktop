// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { ScreenShareStatus } from '../../types/Calling';
import { MinimalSignalContext } from '../minimalContext';

const params = new URLSearchParams(document.location.search);

let renderCallback: undefined | (() => undefined);

let status = ScreenShareStatus.Connected;

const Signal = {
  ScreenShareWindowProps: {
    onStopSharing: () => {
      ipcRenderer.send('stop-screen-share');
    },
    presentedSourceName: params.get('sourceName'),
    getStatus() {
      return status;
    },
    setRenderCallback(callback: () => undefined) {
      renderCallback = callback;
    },
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);

ipcRenderer.on('status-change', (_, newStatus: ScreenShareStatus) => {
  status = newStatus;
  renderCallback?.();
});
