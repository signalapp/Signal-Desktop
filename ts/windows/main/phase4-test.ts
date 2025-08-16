// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable global-require */

const { config } = window.SignalContext;

if (config.environment === 'test') {
  console.log('Importing test infrastructure...');
  require('./preload_test');
}

if (config.ciMode) {
  console.log(
    `Importing CI infrastructure; enabled in config, mode: ${config.ciMode}`
  );
  const { getCI } = require('../../CI');
  window.SignalCI = getCI({
    deviceName: window.getTitle(),
    forceUnprocessed: config.ciForceUnprocessed,
  });
}
