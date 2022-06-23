// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../shims';

/* eslint-disable global-require */

import * as log from '../../logging/log';

window.preloadStartTime = Date.now();

try {
  require('./start');
} catch (error) {
  /* eslint-disable no-console */
  if (console._log) {
    console._log('preload error!', error.stack);
  }
  console.log('preload error!', error.stack);
  /* eslint-enable no-console */

  throw error;
}

window.preloadEndTime = Date.now();
log.info('preload complete');
