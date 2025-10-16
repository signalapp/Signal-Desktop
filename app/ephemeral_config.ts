// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';

import { app } from 'electron';

import { start } from './base_config.node.js';

const userDataPath = app.getPath('userData');
const targetPath = join(userDataPath, 'ephemeral.json');

export const ephemeralConfig = start({
  name: 'ephemeral',
  targetPath,
  throwOnFilesystemErrors: false,
});

export const get = ephemeralConfig.get.bind(ephemeralConfig);
export const remove = ephemeralConfig.remove.bind(ephemeralConfig);
export const set = ephemeralConfig.set.bind(ephemeralConfig);
