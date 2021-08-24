// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { app } from 'electron';

import { start } from './base_config';
import config from './config';

// Use separate data directory for benchmarks & development
if (config.has('storagePath')) {
  app.setPath('userData', String(config.get('storagePath')));
} else if (config.has('storageProfile')) {
  const userData = join(
    app.getPath('appData'),
    `Signal-${config.get('storageProfile')}`
  );

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = join(userDataPath, 'config.json');

export const userConfig = start('user', targetPath);

export const get = userConfig.get.bind(userConfig);
export const remove = userConfig.remove.bind(userConfig);
export const set = userConfig.set.bind(userConfig);
