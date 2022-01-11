// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { mkdirSync } from 'fs';
import { app } from 'electron';

import { start } from './base_config';
import config from './config';

let userData: string | undefined;
// Use separate data directory for benchmarks & development
if (config.has('storagePath')) {
  userData = String(config.get('storagePath'));
} else if (config.has('storageProfile')) {
  userData = join(
    app.getPath('appData'),
    `Signal-${config.get('storageProfile')}`
  );
}

if (userData !== undefined) {
  try {
    mkdirSync(userData, { recursive: true });
  } catch (error) {
    console.error('Failed to create userData', error?.stack || String(error));
  }

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = join(userDataPath, 'config.json');

export const userConfig = start({
  name: 'user',
  targetPath,
  throwOnFilesystemErrors: true,
});

export const get = userConfig.get.bind(userConfig);
export const remove = userConfig.remove.bind(userConfig);
export const set = userConfig.set.bind(userConfig);
