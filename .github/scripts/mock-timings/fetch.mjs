// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * Prints average mock test durations per file from Buildkite Test Engine as
 * JSON for `MOCHA_TIMINGS`. Prints nothing and warns when they can't be
 * fetched, so the tests are split by index instead.
 */

import { parseArgs } from 'node:util';
import { getFileDurations } from './getFileDurations.mjs';

/** @import { TestEngineTest } from './getFileDurations.mjs' */

const API_URL =
  process.env.BUILDKITE_TEST_ENGINE_API_URL ??
  'https://api.buildkite.com/v2/analytics';
const API_TOKEN = process.env.BUILDKITE_TEST_ENGINE_API_ACCESS_TOKEN ?? '';
if (API_TOKEN === '') {
  warn('No BUILDKITE_TEST_ENGINE_API_ACCESS_TOKEN');
  process.exit(0);
}

const TESTS_PATH =
  '/organizations/signal-messenger-llc/suites/desktop-mock-tests/tests';
const API_VERSION = '2026-08-01';
const PER_PAGE = 100;
const MAX_PAGES = 50;
const REQUEST_TIMEOUT = 30_000;

/** The `tags` of each config in .github/test-engine */
const VARIANT_TAGS = ['e164:on', 'e164:off'];

const { values: args } = parseArgs({
  options: {
    branch: { type: 'string', default: 'main' },
    // Can't be longer than the organization's Test Engine window
    period: { type: 'string', default: '7days' },
  },
});

/**
 * @typedef {object} FetchTestsParams
 * @prop {string} token
 * @prop {string} tags
 * @prop {number} page
 */

/**
 * @param {FetchTestsParams} params
 * @returns {Promise<ReadonlyArray<TestEngineTest>>}
 */
async function fetchTestsPage(params) {
  const url = new URL(API_URL + TESTS_PATH);
  url.searchParams.set('branch', args.branch);
  url.searchParams.set('period', args.period);
  url.searchParams.set('tags', params.tags);
  url.searchParams.set('per_page', `${PER_PAGE}`);
  url.searchParams.set('page', `${params.page}`);

  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${params.token}`,
    'Buildkite-Version': API_VERSION,
  });
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GET ${url} -> ${response.status} ${response.statusText}: ${body}`
    );
  }

  const tests = await response.json();
  if (!Array.isArray(tests)) {
    throw new Error(`GET ${url} -> Expected an array`);
  }
  return tests;
}

/**
 * @param {FetchTestsParams} params
 * @returns {Promise<ReadonlyArray<TestEngineTest>>}
 */
async function fetchAllTests(params) {
  if (params.page > MAX_PAGES) {
    throw new Error(`More than ${MAX_PAGES} pages of tests for ${params.tags}`);
  }
  const tests = await fetchTestsPage(params);
  if (tests.length < PER_PAGE) {
    return tests;
  }
  const nextTests = await fetchAllTests({ ...params, page: params.page + 1 });
  return [...tests, ...nextTests];
}

/** @param {string} message */
function warn(message) {
  console.error(`::warning::Mock test timings: ${message}`);
}

/** @type {Array<ReadonlyArray<TestEngineTest>>} */
let testsByVariant;
try {
  testsByVariant = await Promise.all(
    VARIANT_TAGS.map(tags => {
      return fetchAllTests({ token: API_TOKEN, tags, page: 1 });
    })
  );
} catch (error) {
  warn(error instanceof Error ? error.message : 'Unknown error');
  process.exit(0);
}

const durations = getFileDurations(testsByVariant);
const fileCount = Object.keys(durations).length;
if (fileCount === 0) {
  warn(`No durations for ${args.branch} in the last ${args.period}`);
  process.exit(0);
}

console.error(`Fetched durations for ${fileCount} files`);
console.log(JSON.stringify(durations));
