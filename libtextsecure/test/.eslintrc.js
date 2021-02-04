// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

module.exports = {
  env: {
    browser: true,
    node: false,
    mocha: true,
  },
  parserOptions: {
    sourceType: 'script',
  },
  rules: {
    strict: 'off',
    'more/no-then': 'off',
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
};
