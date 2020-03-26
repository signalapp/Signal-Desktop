const path = require('path');

const isDevelopment = require('electron-is-dev');

let environment;

// In production mode, NODE_ENV cannot be customized by the user
if (isDevelopment) {
  console.log('development');
  environment = process.env.NODE_ENV || 'development';
  process.env.LOKI_DEV = 1;
} else {
  environment = 'production';
}

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, '..', 'config');

if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = !isDevelopment;
  process.env.HOSTNAME = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '';

  // We could be running againt production but still be in dev mode, we need to handle that
  if (!isDevelopment) {
    process.env.NODE_APP_INSTANCE = '';
  }
}

// We load config after we've made our modifications to NODE_ENV
const config = require('config');

config.environment = environment;

// Log resulting env vars in use by config
[
  'NODE_ENV',
  'NODE_APP_INSTANCE',
  'NODE_CONFIG_DIR',
  'NODE_CONFIG',
].forEach(s => {
  console.log(`${s} ${config.util.getEnv(s)}`);
});

module.exports = config;
