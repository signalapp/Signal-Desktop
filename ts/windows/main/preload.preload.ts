// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable global-require */

import { createLogger } from '../../logging/log.std.js';

const log = createLogger('preload');

window.preloadStartTime = Date.now();

try {
  require('./start.preload.js');
} catch (error) {
  /* eslint-disable no-console */
  console.log('preload error!', error.stack);
  /* eslint-enable no-console */
  try {
    log.info('error!', error.stack);
  } catch {
    // Best effort
  }

  throw error;
}

window.preloadEndTime = Date.now();
log.info('complete');
