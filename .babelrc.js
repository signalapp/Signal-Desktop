// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

module.exports = {
  presets: ['@babel/preset-react', '@babel/preset-typescript'],
  // Detects the type of file being babel'd (either esmodule or commonjs)
  sourceType: 'unambiguous',
  plugins: [
    'react-hot-loader/babel',
    'lodash',
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-proposal-optional-chaining',
    // This plugin converts commonjs to esmodules which is required for
    // importing commonjs modules from esmodules in storybook. As a part of
    // converting to TypeScript we should use esmodules and can eventually
    // remove this plugin
    process.env.SIGNAL_ENV === 'storybook' && '@babel/transform-runtime',
  ].filter(Boolean),
};
