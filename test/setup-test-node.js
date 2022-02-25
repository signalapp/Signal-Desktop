// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const { Crypto } = require('../ts/context/Crypto');
const { setEnvironment, Environment } = require('../ts/environment');

chai.use(chaiAsPromised);

setEnvironment(Environment.Test);

const storageMap = new Map();

// To replicate logic we have on the client side
global.window = {
  Date,
  performance,
  SignalContext: {
    crypto: new Crypto(),
    log: {
      info: (...args) => console.log(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
    },
  },
  i18n: key => `i18n(${key})`,
  storage: {
    get: key => storageMap.get(key),
    put: async (key, value) => storageMap.set(key, value),
  },
};

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};
