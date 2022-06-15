// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge } from 'electron';

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

    let platform = '';
    if (process.platform === 'darwin') {
      if (process.arch === 'arm64') {
        platform = ' (M1)';
      } else {
        platform = ' (Intel)';
      }
    }

    ReactDOM.render(
      React.createElement(About, {
        closeAbout: () => SignalContext.executeMenuRole('close'),
        environment: `${environmentText.join(' - ')}${platform}`,
        i18n: SignalContext.i18n,
        version: SignalContext.getVersion(),
        platform: process.platform,
        isWindows11: SignalContext.OS.isWindows11(),
        executeMenuRole: SignalContext.executeMenuRole,
      }),
      document.getElementById('app')
    );
  },
});
