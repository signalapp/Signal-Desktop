// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { resolve } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration, EnvironmentPlugin, ProvidePlugin } from 'webpack';
import HtmlWebpackPlugin = require('html-webpack-plugin');
import TerserPlugin = require('terser-webpack-plugin');

const context = __dirname;
const { NODE_ENV: mode = 'development' } = process.env;
const isDev = mode === 'development';

const csp = `
  default-src 'none';
  child-src 'self';
  connect-src 'self'${isDev ? ' http: ws:' : ''};
  font-src 'self';
  form-action 'self';
  frame-src 'none';
  img-src 'self' blob: data:;
  media-src 'self' blob:;
  object-src 'none';
  script-src 'self'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline';
`;

const stickerCreatorConfig: Configuration = {
  context,
  mode: mode as Configuration['mode'],
  entry: [
    'react-hot-loader/patch',
    'sanitize.css',
    'typeface-inter',
    './sticker-creator/index.tsx',
  ],
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
  output: {
    path: resolve(context, 'sticker-creator/dist'),
    filename: 'bundle.js',
    publicPath: mode === 'production' ? './' : '/sticker-creator/dist/',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{ loader: 'babel-loader' }],
      },
      {
        test: /\.css$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
      },
      {
        test: /\.scss$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader?modules=true&localsConvention=camelCaseOnly' },
          { loader: 'sass-loader' },
        ],
      },
      {
        test: /\.woff2?$/,
        use: [{ loader: 'file-loader' }],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {},
  },
  plugins: [
    new ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
    new EnvironmentPlugin(['NODE_ENV']),
    new HtmlWebpackPlugin({
      title: 'Signal Sticker Creator',
      template: resolve(context, 'sticker-creator/index.html'),
      meta: {
        'Content-Security-Policy': {
          'http-equiv': 'Content-Security-Policy',
          content: csp,
        },
      },
    }),
  ],
};

export default [stickerCreatorConfig];
