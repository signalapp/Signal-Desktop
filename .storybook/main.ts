// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorybookConfig } from '@storybook/react-webpack5';
import { ProvidePlugin } from 'webpack';

const config: StorybookConfig = {
  typescript: {
    reactDocgen: false,
  },

  stories: ['../ts/components/**/*.stories.tsx'],

  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-actions',
    '@storybook/addon-controls',
    '@storybook/addon-measure',
    '@storybook/addon-toolbars',
    '@storybook/addon-viewport',
    '@storybook/addon-jest',
    // This must be imported last.
    '@storybook/addon-interactions',
    '@storybook/addon-webpack5-compiler-swc',
  ],

  framework: '@storybook/react-webpack5',

  core: {
    disableTelemetry: true,
  },

  features: {},

  staticDirs: [
    { from: '../fonts', to: 'fonts' },
    { from: '../images', to: 'images' },
    { from: '../fixtures', to: 'fixtures' },
    {
      from: '../node_modules/emoji-datasource-apple/img',
      to: 'node_modules/emoji-datasource-apple/img',
    },
    {
      from: '../node_modules/intl-tel-input/build/img',
      to: 'node_modules/intl-tel-input/build/img',
    },
  ],

  webpackFinal(config) {
    config.cache = {
      type: 'filesystem',
    };

    config.resolve!.extensions = ['.tsx', '.ts', '...'];

    config.module!.rules!.unshift({
      test: /\.scss$/,
      use: [
        { loader: 'style-loader' },
        { loader: 'css-loader', options: { modules: false, url: false } },
        { loader: 'sass-loader' },
      ],
    });

    config.module!.rules!.unshift({
      test: /\.css$/,
      use: [
        // prevent storybook defaults from being applied
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
      'mac-screen-capture-permissions':
        'commonjs mac-screen-capture-permissions',
      sass: 'commonjs sass',
      bufferutil: 'commonjs bufferutil',
      'utf-8-validate': 'commonjs utf-8-validate',
    };

    config.plugins!.push(
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );

    return config;
  },

  docs: {},
};

export default config;
