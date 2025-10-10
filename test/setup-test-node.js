// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const { Crypto } = require('../ts/context/Crypto.js');
const { setEnvironment, Environment } = require('../ts/environment.js');
const { HourCyclePreference } = require('../ts/types/I18N.js');
const { default: package } = require('../ts/util/packageJson.js');

chai.use(chaiAsPromised);

setEnvironment(Environment.Test, true);

// To replicate logic we have on the client side
global.window = {
  Date,
  performance,
  SignalContext: {
    getPath: () => '/tmp',
    getVersion: () => package.version,
    config: {
      serverUrl: 'https://127.0.0.1:9',
      storageUrl: 'https://127.0.0.1:9',
      updatesUrl: 'https://127.0.0.1:9',
      resourcesUrl: 'https://127.0.0.1:9',
      certificateAuthority: package.certificateAuthority,
      version: package.version,
    },
    crypto: new Crypto(),
    getResolvedMessagesLocale: () => 'en',
    getResolvedMessagesLocaleDirection: () => 'ltr',
    getHourCyclePreference: () => HourCyclePreference.UnknownPreference,
    getPreferredSystemLocales: () => ['en'],
    getLocaleOverride: () => null,
  },
  i18n: key => `i18n(${key})`,
};

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};

// For GlobalAudioContext.tsx
/* eslint max-classes-per-file: ["error", 2] */
global.AudioContext = class {};
global.Audio = class {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  pause() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  addEventListener() {}
};
