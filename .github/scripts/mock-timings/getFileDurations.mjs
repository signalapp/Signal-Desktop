// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * The fields used from Test Engine's `TestWithMetrics`
 *
 * @typedef {Readonly<{
 *   file_name?: string | null,
 *   duration_avg?: number | null,
 * }>} TestEngineTest
 */

/**
 * @param {ReadonlyArray<TestEngineTest>} tests
 */
function sumSecondsByFile(tests) {
  /** @type {Map<string, number>} */
  const secondsByFile = new Map();
  for (const test of tests) {
    if (test.file_name == null || test.duration_avg == null) {
      continue;
    }
    const sum = secondsByFile.get(test.file_name) ?? 0;
    secondsByFile.set(test.file_name, sum + test.duration_avg);
  }
  return secondsByFile;
}

/**
 * Milliseconds per test file for `MOCHA_TIMINGS`, from the slower variant
 *
 * @param {ReadonlyArray<ReadonlyArray<TestEngineTest>>} testsByVariant
 * @returns {Readonly<Record<string, number>>}
 */
export function getFileDurations(testsByVariant) {
  /** @type {Map<string, number>} */
  const maxDurations = new Map();
  for (const tests of testsByVariant) {
    for (const [file, duration] of sumSecondsByFile(tests)) {
      const max = maxDurations.get(file) ?? 0;
      maxDurations.set(file, Math.max(max, duration));
    }
  }

  /** @type {Record<string, number>} */
  const result = {};
  for (const [file, duration] of maxDurations) {
    result[file] = Math.round(duration * 1000);
  }
  return result;
}
