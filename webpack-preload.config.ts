// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration } from 'webpack';
import TerserPlugin = require('terser-webpack-plugin');

const context = __dirname;
const { NODE_ENV: mode = 'development' } = process.env;

const EXTERNAL_MODULE = new Set([
  '@signalapp/signal-client',
  '@signalapp/signal-client/zkgroup',
  'backbone',
  'better-sqlite3',
  'fs-xattr',
  'fsevents',
  'got',
  'jquery',
  'mac-screen-capture-permissions',
  'node-fetch',
  'node-sass',
  'pino',
  'proxy-agent',
  'ringrtc',
  'sharp',
  'websocket',

  // Uses fast-glob and dynamic requires
  './preload_test',

  // Needs to exports `electronRequire`
  './ts/CI',
]);

const preloadConfig: Configuration = {
  context,
  mode: mode as Configuration['mode'],
  devtool: mode === 'development' ? 'inline-source-map' : false,
  entry: ['./preload.js'],
  // Stack-traces have to be readable so don't mangle function names.
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          mangle: false,
          keep_classnames: true,
          keep_fnames: true,
        },
      }),
    ],
  },
  target: 'electron-preload',
  output: {
    path: resolve(context),
    filename: 'preload.bundle.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.js'],
    alias: {},
    mainFields: ['browser', 'main'],
  },
  externals: [
    ({ request = '' }, callback) => {
      if (EXTERNAL_MODULE.has(request)) {
        return callback(undefined, `commonjs2 ${request}`);
      }

      callback();
    },
  ],
};

export default [preloadConfig];
