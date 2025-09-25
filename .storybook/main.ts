// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorybookConfig } from '@storybook/react-webpack5';
import { ProvidePlugin } from 'webpack';
import { builtinModules } from 'node:module';

const EXTERNALS = new Set(builtinModules);

// We have polyfills for these
EXTERNALS.delete('buffer');
EXTERNALS.delete('url');

const config: StorybookConfig = {
  typescript: {
    reactDocgen: false,
  },

  stories: ['../ts/axo/**/*.stories.tsx', '../ts/components/**/*.stories.tsx'],

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

    config.resolve!.extensionAlias = {
      '.js': ['.tsx', '.ts', '.js'],
    };

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

    config.module!.rules!.push({
      test: /tailwind-config\.css$/,
      use: [
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions: {
              config: false,
              plugins: {
                '@tailwindcss/postcss': {},
              },
            },
          },
        },
      ],
    });

    config.node = { global: true };

    config.externals = ({ request }, callback) => {
      if (
        (/^node:/.test(request) && request !== 'node:buffer') ||
        EXTERNALS.has(request)
      ) {
        // Keep Node.js imports unchanged
        return callback(null, 'commonjs ' + request);
      }
      callback();
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
