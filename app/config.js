const fs = require('fs');
const path = require('path');

console.log('reading package.json');
const jsonFile = fs.readFileSync(path.join(__dirname, '..', 'package.json'));
const package_json = JSON.parse(jsonFile, 'utf-8');
const environment = package_json.environment || process.env.NODE_ENV || 'development';

console.log('configuring');

// Set environment vars to configure node-config before requiring it
process.env.NODE_ENV = environment;
process.env.NODE_CONFIG_DIR = path.join(__dirname, '..', 'config');

if (environment === 'production') {
  // harden production config against the local env
  process.env.NODE_CONFIG = '';
  process.env.NODE_CONFIG_STRICT_MODE = true;
  process.env.HOSTNAME = '';
  process.env.NODE_APP_INSTANCE = '';
  process.env.ALLOW_CONFIG_MUTATIONS = '';
  process.env.SUPPRESS_NO_CONFIG_WARNING = '';
}

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
  'SUPPRESS_NO_CONFIG_WARNING'
].forEach(function(s) {
  console.log(s + ' ' + config.util.getEnv(s));
});

module.exports = config;
