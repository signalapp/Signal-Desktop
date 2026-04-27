// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

const SIGNAL_CI_CONFIG = process.env.SIGNAL_CI_CONFIG ?? '';
if (SIGNAL_CI_CONFIG === '') {
  throw new Error('Missing SIGNAL_CI_CONFIG');
}

/** @type {unknown} */
let parsedConfig;
try {
  parsedConfig = JSON.parse(SIGNAL_CI_CONFIG);
} catch (error) {
  throw new Error(`Invalid JSON in SIGNAL_CI_CONFIG: ${SIGNAL_CI_CONFIG}`, {
    cause: error,
  });
}

const { Util } = require('config/lib/util.js');

// Must be loaded after parsing SIGNAL_CI_CONFIG
const config = require('./bundles/config.js').default;

Util.extendDeep(config, parsedConfig);

require('./bundles/main.js');
