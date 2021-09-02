// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const webpack = require('webpack');

module.exports = ({ config }) => {
  config.entry.unshift(
    '!!style-loader!css-loader!sanitize.css',
    '!!style-loader!css-loader!typeface-inter'
  );

  config.module.rules.unshift(
    {
      test: /\.[jt]sx?$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
    },
    {
      test: /\.scss$/,
      loaders: [
        'style-loader',
        'css-loader?modules=true&localsConvention=camelCaseOnly',
        'sass-loader',
      ],
    }
  );

  config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js'];

  config.externals = {
    net: 'net',
  };

  return config;
};
