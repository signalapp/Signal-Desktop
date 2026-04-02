// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/** @type {import("@babel/core").TransformOptions} */
const config = {
  presets: ['@babel/preset-react', '@babel/preset-typescript'],
  // Detects the type of file being babel'd (either esmodule or commonjs)
  sourceType: 'unambiguous',
  plugins: [
    'lodash',
    '@babel/plugin-transform-typescript',
    // This plugin converts commonjs to esmodules which is required for
    // importing commonjs modules from esmodules in storybook. As a part of
    // converting to TypeScript we should use esmodules and can eventually
    // remove this plugin
    process.env.SIGNAL_ENV === 'storybook' && '@babel/transform-runtime',
  ].filter(plugin => {
    return typeof plugin === 'string';
  }),
};

export default config;
