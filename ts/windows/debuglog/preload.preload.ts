// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.js';

function downloadLog(logText: string) {
  ipcRenderer.send('show-debug-log-save-dialog', logText);
}

async function fetchLogs() {
  const data = await ipcRenderer.invoke('fetch-log');
  return ipcRenderer.invoke(
    'DebugLogs.getLogs',
    data,
    window.navigator.userAgent
  );
}

function uploadLogs(logs: string) {
  return ipcRenderer.invoke('DebugLogs.upload', logs);
}

const Signal = {
  DebugLogWindowProps: {
    downloadLog,
    fetchLogs,
    uploadLogs,
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
