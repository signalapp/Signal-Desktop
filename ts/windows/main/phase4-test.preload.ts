// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { config } = window.SignalContext;

export {};

if (config.environment === 'test') {
  // oxlint-disable-next-line no-console
  console.log('Importing test infrastructure...');
  // oxlint-disable-next-line node/global-require
  require('./preload_test.preload.ts');
}

if (config.ciMode) {
  // oxlint-disable-next-line no-console
  console.log(
    `Importing CI infrastructure; enabled in config, mode: ${config.ciMode}`
  );
  // oxlint-disable-next-line node/global-require, typescript/no-var-requires
  const { getCI } = require('../../CI.preload.js');
  window.SignalCI = getCI({
    deviceName: window.getTitle(),
    forceUnprocessed: config.ciForceUnprocessed,
  });
}
