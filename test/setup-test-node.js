// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

const { Crypto } = require('../ts/context/Crypto.node.js');
const { setEnvironment, Environment } = require('../ts/environment.std.js');
const { HourCyclePreference } = require('../ts/types/I18N.std.js');
const { packageJson } = require('../ts/util/packageJson.node.js');

chai.use(chaiAsPromised);

setEnvironment(Environment.Test, true);

// To replicate logic we have on the client side
global.window = {
  Date,
  performance,
  SignalContext: {
    i18n: key => `i18n(${key})`,
    getPath: () => '/tmp',
    getVersion: () => packageJson.version,
    config: {
      serverUrl: 'https://127.0.0.1:9',
      storageUrl: 'https://127.0.0.1:9',
      updatesUrl: 'https://127.0.0.1:9',
      resourcesUrl: 'https://127.0.0.1:9',
      certificateAuthority: packageJson.certificateAuthority,
      version: packageJson.version,
    },
    crypto: new Crypto(),
    getResolvedMessagesLocale: () => 'en',
    getResolvedMessagesLocaleDirection: () => 'ltr',
    getHourCyclePreference: () => HourCyclePreference.UnknownPreference,
    getPreferredSystemLocales: () => ['en'],
    getLocaleOverride: () => null,
  },
};

// For ducks/network.getEmptyState()
global.navigator = {};
global.WebSocket = {};

// For GlobalAudioContext.tsx
global.AudioContext = class {};
// oxlint-disable-next-line max-classes-per-file
global.Audio = class {
  // oxlint-disable-next-line typescript/no-empty-function
  pause() {}
  // oxlint-disable-next-line typescript/no-empty-function
  addEventListener() {}
};
