// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join, basename } from 'path';
import { app } from 'electron';

import type { IConfig } from 'config';

import {
  Environment,
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} from '../ts/environment';

// In production mode, NODE_ENV cannot be customized by the user
if (app.isPackaged) {
  setEnvironment(Environment.PackagedApp, false);
} else {
  setEnvironment(
    parseEnvironment(process.env.NODE_ENV || 'development'),
    Boolean(process.env.MOCK_TEST)
  );
}

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = getEnvironment();
process.env.NODE_CONFIG_DIR = join(__dirname, '..', 'config');

if (getEnvironment() === Environment.PackagedApp) {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = '';
  process.env.HOSTNAME = '';
  process.env.NODE_APP_INSTANCE = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '';
  process.env.SIGNAL_ENABLE_HTTP = '';
  process.env.SIGNAL_CI_CONFIG = '';
  process.env.GENERATE_PRELOAD_CACHE = '';
  process.env.REACT_DEVTOOLS = '';
}

// We load config after we've made our modifications to NODE_ENV
// Note: we use `require()` because esbuild moves the imports to the top of
// the module regardless of their actual placement in the file.
// See: https://github.com/evanw/esbuild/issues/2011
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config: IConfig = require('config');

if (getEnvironment() !== Environment.PackagedApp) {
  config.util.getConfigSources().forEach(source => {
    console.log(`config: Using config source ${basename(source.name)}`);
  });
}

// Log resulting env vars in use by config
[
  'NODE_ENV',
  'NODE_CONFIG_DIR',
  'NODE_CONFIG',
  'ALLOW_CONFIG_MUTATIONS',
  'HOSTNAME',
  'NODE_APP_INSTANCE',
  'SUPPRESS_NO_CONFIG_WARNING',
  'SIGNAL_ENABLE_HTTP',
].forEach(s => {
  console.log(`${s} ${config.util.getEnv(s)}`);
});

export default config;
export type { IConfig as ConfigType };
