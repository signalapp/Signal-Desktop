/* eslint-disable no-console */
import path from 'path';

import { app } from 'electron';

let environment;
const isPackaged = app.isPackaged;

// In production mode, NODE_ENV cannot be customized by the user
if (isPackaged) {
  environment = 'production';
  // We could be running against production but still be in dev mode, we need to handle that
  process.env.NODE_APP_INSTANCE = '';
} else {
  environment = process.env.NODE_ENV || 'development';
}

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = `${isPackaged ? 1 : 0}`; // we want to force strict mode when we are packaged
  process.env.HOSTNAME = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
}

// We load config after we've made our modifications to NODE_ENV
// eslint-disable-next-line @typescript-eslint/no-var-requires
const c = require('config');

c.environment = environment;

// Log resulting env vars in use by config
['NODE_ENV', 'NODE_APP_INSTANCE', 'NODE_CONFIG_DIR', 'NODE_CONFIG'].forEach(s => {
  console.log(`${s} ${c.util.getEnv(s)}`);
});

export const config = c;
