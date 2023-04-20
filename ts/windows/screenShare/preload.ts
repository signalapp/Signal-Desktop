// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { MinimalSignalContext } from '../minimalContext';

const params = new URLSearchParams(document.location.search);

const Signal = {
  ScreenShareWindowProps: {
    onStopSharing: () => {
      ipcRenderer.send('stop-screen-share');
    },
    presentedSourceName: params.get('sourceName'),
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
