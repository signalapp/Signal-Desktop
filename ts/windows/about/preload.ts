// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

import { SignalContext } from '../context';
import { About } from '../../components/About';

contextBridge.exposeInMainWorld('SignalContext', {
  ...SignalContext,
  renderWindow: () => {
    const environmentText: Array<string> = [SignalContext.getEnvironment()];

    const appInstance = SignalContext.getAppInstance();
    if (appInstance) {
      environmentText.push(appInstance);
    }

    ReactDOM.render(
      React.createElement(About, {
        closeAbout: () => ipcRenderer.send('close-about'),
        environment: environmentText.join(' - '),
        i18n: SignalContext.i18n,
        version: SignalContext.getVersion(),
      }),
      document.getElementById('app')
    );
  },
});
