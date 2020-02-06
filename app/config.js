const path = require('path');

const electronIsDev = require('electron-is-dev');

let environment;

// In production mode, NODE_ENV cannot be customized by the user
if (electronIsDev) {
  environment = process.env.NODE_ENV || 'development';
} else {
  environment = 'production';
}

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, '..', 'config');

if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = true;
  process.env.HOSTNAME = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '';
  if (!process.env.LOKI_DEV) {
    process.env.NODE_APP_INSTANCE = '';
  }
}

// We load config after we've made our modifications to NODE_ENV
const config = require('config');

config.environment = environment;

// Log resulting env vars in use by config
[
  'NODE_ENV',
  'NODE_CONFIG_DIR',
  'NODE_CONFIG',
  'ALLOW_CONFIG_MUTATIONS',
  'HOSTNAME',
  'NODE_APP_INSTANCE',
  'SUPPRESS_NO_CONFIG_WARNING',
].forEach(s => {
  console.log(`${s} ${config.util.getEnv(s)}`);
});

module.exports = config;
