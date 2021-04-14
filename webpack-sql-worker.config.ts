// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve, join } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration } from 'webpack';

const context = __dirname;

// A path relative to `ts/sql/` in `asar.unpacked`
const libDir = join('..', '..', 'node_modules', 'better-sqlite3');
const bindingFile = join(libDir, 'build', 'Release', 'better_sqlite3.node');

const workerConfig: Configuration = {
  context,
  mode: 'development',
  devtool: false,
  entry: ['./ts/sql/mainWorker.js'],
  target: 'node',
  output: {
    path: resolve(context, 'ts', 'sql'),
    filename: 'mainWorker.bundle.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      bindings: join(context, 'ts', 'sql', 'mainWorkerBindings.js'),
    },
  },
  externals: {
    'better_sqlite3.node': `commonjs2 ${bindingFile}`,
  },
};

export default [workerConfig];
