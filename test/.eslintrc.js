// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// For reference: https://github.com/airbnb/javascript

module.exports = {
  env: {
    mocha: true,
    browser: true,
  },

  globals: {
    assert: true,
    assertEqualArrayBuffers: true,
    dcodeIO: true,
    getString: true,
    hexToArrayBuffer: true,
    MockServer: true,
    MockSocket: true,
    PROTO_ROOT: true,
    stringToArrayBuffer: true,
  },

  parserOptions: {
    sourceType: 'script',
  },

  rules: {
    // We still get the value of this rule, it just allows for dev deps
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: true,
      },
    ],

    // We want to keep each test structured the same, even if its contents are tiny
    'arrow-body-style': 'off',

    strict: 'off',
    'more/no-then': 'off',
  },
};
