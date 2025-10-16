// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const CI_CONFIG = JSON.parse(process.env.SIGNAL_CI_CONFIG || '');

const config = require('./app/config.main.js').default;

config.util.extendDeep(config, CI_CONFIG);

require('./app/main.main.js');
