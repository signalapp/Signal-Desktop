// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const config = require('./app/config').default;

config.util.extendDeep(config, JSON.parse(process.env.SIGNAL_CI_CONFIG || ''));

require('./app/main');
