// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.js';
import { config } from '../../context/config.preload.js';
import { environment } from '../../context/environment.preload.js';

const environments: Array<string> = [environment];

if (config.appInstance) {
  environments.push(String(config.appInstance));
}

const Signal = {
  AboutWindowProps: {
    appEnv: environments.join(' - '),
    arch: process.arch,
    platform: process.platform,
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
