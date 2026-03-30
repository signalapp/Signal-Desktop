// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.js';

const log = createLogger('preload');

window.preloadStartTime = Date.now();

try {
  // oxlint-disable-next-line node/global-require
  require('./start.preload.js');
} catch (error) {
  // oxlint-disable-next-line no-console
  console.log('preload error!', error.stack);
  try {
    log.info('error!', error.stack);
  } catch {
    // Best effort
  }

  throw error;
}

window.preloadEndTime = Date.now();
log.info('complete');
