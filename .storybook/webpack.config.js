// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const webpack = require('webpack');

module.exports = ({ config }) => {
  config.entry.unshift('!!style-loader!css-loader!sanitize.css');

  config.cache = {
    type: 'filesystem',
  };

  config.module.rules.unshift({
    test: /\.scss$/,
    use: [
      { loader: 'style-loader' },
      { loader: 'css-loader?modules=true&localsConvention=camelCaseOnly' },
      { loader: 'sass-loader' },
    ],
  });

  config.node = { global: true };

  config.externals = {
    net: 'commonjs net',
    vm: 'commonjs vm',
    fs: 'commonjs fs',
    async_hooks: 'commonjs async_hooks',
    module: 'commonjs module',
    stream: 'commonjs stream',
    tls: 'commonjs tls',
    dns: 'commonjs dns',
    http: 'commonjs http',
    https: 'commonjs https',
    os: 'commonjs os',
    constants: 'commonjs constants',
    zlib: 'commonjs zlib',
    '@signalapp/libsignal-client': 'commonjs @signalapp/libsignal-client',
    '@signalapp/libsignal-client/zkgroup':
      'commonjs @signalapp/libsignal-client/zkgroup',
    '@signalapp/ringrtc': 'commonjs @signalapp/ringrtc',
    '@signalapp/better-sqlite3': 'commonjs @signalapp/better-sqlite3',
    electron: 'commonjs electron',
    'fs-xattr': 'commonjs fs-xattr',
    fsevents: 'commonjs fsevents',
    'mac-screen-capture-permissions': 'commonjs mac-screen-capture-permissions',
    sass: 'commonjs sass',
    bufferutil: 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
  };

  return config;
};
