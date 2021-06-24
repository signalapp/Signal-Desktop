// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';

import { app } from 'electron';

import { start } from './base_config';

const userDataPath = app.getPath('userData');
const targetPath = join(userDataPath, 'ephemeral.json');

const ephemeralConfig = start('ephemeral', targetPath, {
  allowMalformedOnStartup: true,
});

export const get = ephemeralConfig.get.bind(ephemeralConfig);
export const remove = ephemeralConfig.remove.bind(ephemeralConfig);
export const set = ephemeralConfig.set.bind(ephemeralConfig);
