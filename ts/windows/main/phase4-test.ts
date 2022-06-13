// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable global-require */

const { config } = window.SignalContext;

if (config.environment === 'test') {
  console.log('Importing test infrastructure...');
  require('./preload_test');
}
if (config.enableCI) {
  console.log('Importing CI infrastructure...');
  const { CI } = require('../../CI');
  window.CI = new CI(window.getTitle());
}
