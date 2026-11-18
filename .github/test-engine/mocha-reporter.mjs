// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import BuildkiteReporter from 'buildkite-test-collector/mocha/reporter.js';

/**
 * Changes:
 * - Reports `this.skip()` as 'skipped' instead of 'pending'
 * - Test durations include their beforeEach hooks
 */
export default class MochaReporter extends BuildkiteReporter {
  /** @param {string} state */
  testEngineResult(state) {
    if (state === 'pending') {
      return 'skipped';
    }
    return super.testEngineResult(state);
  }

  /** @param {unknown} test */
  testFinished(test) {
    super.testFinished(test);
    const { history } = this._testResults.at(-1);
    // `it.skip()` tests never start
    if (typeof history.start_at === 'number') {
      history.duration = history.end_at - history.start_at;
    }
  }
}
