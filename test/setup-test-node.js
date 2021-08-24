// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const { setEnvironment, Environment } = require('../ts/environment');
const { Context: SignalContext } = require('../ts/context');
const { isValidGuid } = require('../ts/util/isValidGuid');

chai.use(chaiAsPromised);

setEnvironment(Environment.Test);

const storageMap = new Map();

// To replicate logic we have on the client side
global.window = {
  SignalContext: undefined,
  log: {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  },
  i18n: key => `i18n(${key})`,
  storage: {
    get: key => storageMap.get(key),
    put: async (key, value) => storageMap.set(key, value),
  },
  isValidGuid,
};

const fakeIPC = {
  sendSync(channel) {
    // See `ts/context/NativeThemeListener.ts`
    if (channel === 'native-theme:init') {
      return { shouldUseDarkColors: true };
    }

    throw new Error(`Unsupported sendSync channel: ${channel}`);
  },

  on() {},
};

global.window.SignalContext = new SignalContext(fakeIPC);

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};
