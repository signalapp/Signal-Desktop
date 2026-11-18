// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { MinimalSignalContext } from '../minimalContext.sandbox.ts';
import { config } from '../../context/config.sandbox.ts';
import { environment } from '../../context/environment.sandbox.ts';

const environments: Array<string> = [environment];

if (config.appInstance) {
  environments.push(config.appInstance);
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
