import path from 'path';

import electronIsDev from 'electron-is-dev';
// tslint:disable: no-console

let environment;

// In production mode, NODE_ENV cannot be customized by the user
if (electronIsDev) {
  environment = process.env.NODE_ENV || 'development';
} else {
  environment = 'production';
}

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = `${!electronIsDev}`;
  process.env.HOSTNAME = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';

  // We could be running againt production but still be in dev mode, we need to handle that
  if (!electronIsDev) {
    process.env.NODE_APP_INSTANCE = '';
  }
}

// We load config after we've made our modifications to NODE_ENV
//tslint-disable no-require-imports no-var-requires
// tslint:disable-next-line: no-require-imports no-var-requires
const c = require('config');
c.environment = environment;

// Log resulting env vars in use by config
['NODE_ENV', 'NODE_APP_INSTANCE', 'NODE_CONFIG_DIR', 'NODE_CONFIG'].forEach(s => {
  console.log(`${s} ${c.util.getEnv(s)}`);
});

export const config = c;
