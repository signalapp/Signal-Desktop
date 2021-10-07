// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

// It is important to call this as early as possible
import '../context';

import { SignalWindow } from '../configure';
import { About } from '../../components/About';

contextBridge.exposeInMainWorld('SignalWindow', {
  ...SignalWindow,
  renderWindow: () => {
    const environmentText: Array<string> = [SignalWindow.getEnvironment()];

    const appInstance = SignalWindow.getAppInstance();
    if (appInstance) {
      environmentText.push(appInstance);
    }

    ReactDOM.render(
      React.createElement(About, {
        closeAbout: () => ipcRenderer.send('close-about'),
        environment: environmentText.join(' - '),
        i18n: SignalWindow.i18n,
        version: SignalWindow.getVersion(),
      }),
      document.getElementById('app')
    );
  },
});
