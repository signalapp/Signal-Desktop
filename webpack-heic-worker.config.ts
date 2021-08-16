// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration } from 'webpack';

const context = __dirname;

const workerConfig: Configuration = {
  context,
  mode: 'development',
  devtool: false,
  entry: ['./ts/workers/heicConverterWorker.js'],
  target: 'node',
  output: {
    path: resolve(context, 'ts', 'workers'),
    filename: 'heicConverter.bundle.js',
    publicPath: './',
  },
};

export default [workerConfig];
