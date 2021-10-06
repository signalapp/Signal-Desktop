// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

// It is important to call this as early as possible
import '../context';

import { SignalWindow } from '../configure';
import { DebugLogWindow } from '../../components/DebugLogWindow';
import * as debugLog from '../../logging/debuglogs';

contextBridge.exposeInMainWorld('SignalWindow', {
  ...SignalWindow,
  renderWindow: () => {
    const environmentText: Array<string> = [SignalWindow.getEnvironment()];

    const appInstance = SignalWindow.getAppInstance();
    if (appInstance) {
      environmentText.push(appInstance);
    }

    ReactDOM.render(
      React.createElement(DebugLogWindow, {
        closeWindow: () => ipcRenderer.send('close-debug-log'),
        downloadLog: (logText: string) =>
          ipcRenderer.send('show-debug-log-save-dialog', logText),
        i18n: SignalWindow.i18n,
        fetchLogs() {
          return debugLog.fetch(
            SignalWindow.getNodeVersion(),
            SignalWindow.getVersion()
          );
        },
        uploadLogs(logs: string) {
          return debugLog.upload(logs, SignalWindow.getVersion());
        },
      }),
      document.getElementById('app')
    );
  },
});
