// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

const ByteBuffer = require('../components/bytebuffer/dist/ByteBufferAB.js');
const { setEnvironment, Environment } = require('../ts/environment');

before(() => {
  setEnvironment(Environment.Test);
});

// To replicate logic we have on the client side
global.window = {
  log: {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  },
  i18n: key => `i18n(${key})`,
  dcodeIO: {
    ByteBuffer,
  },
};

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};
