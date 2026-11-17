// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import BuildkiteReporter from 'buildkite-test-collector/mocha/reporter.js';

/** Re-maps `this.skip()` to 'skipped' instead of 'pending' */
export default class MochaReporter extends BuildkiteReporter {
  /** @param {string} state */
  testEngineResult(state) {
    if (state === 'pending') {
      return 'skipped';
    }
    return super.testEngineResult(state);
  }
}
