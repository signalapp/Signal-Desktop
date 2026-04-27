// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import * as semver from 'semver';
import { assert } from './assert.mjs';

/**
 * @typedef {'prod' | 'beta' | 'alpha' | 'staging' | 'axolotl' | 'adhoc'} VersionChannel
 */

/**
 * @typedef {object} VersionInfo
 * @prop {VersionChannel} channel
 * @prop {number} major
 * @prop {number} minor
 * @prop {number} patch
 * @prop {number | null} prepatch
 * @prop {string[]} build
 * @prop {boolean} isUpdatable
 * @prop {boolean} isNightly
 */

/**
 * @param {string} version
 * @returns {VersionInfo}
 */
export function parseVersion(version) {
  const parsed = semver.parse(version);
  assert(parsed != null, `Invalid version: ${version}`);

  const [pre1, pre2] = parsed.prerelease;

  /** @type {VersionChannel} */
  let channel;
  /** @type {number | null} */
  let prepatch;
  if (pre1 == null) {
    channel = 'prod';
    prepatch = null;
    assert(
      parsed.build.length === 0,
      `Unexpected build info in "prod" version: "${version}"`
    );
  } else if (
    pre1 === 'beta' ||
    pre1 === 'alpha' ||
    pre1 === 'staging' ||
    pre1 === 'axolotl' ||
    pre1 === 'adhoc'
  ) {
    channel = pre1;
    assert(
      typeof pre2 === 'number',
      `Expected channel "${channel}" to have prepatch number in version: "${version}"`
    );
    prepatch = pre2;
  } else {
    throw new TypeError(
      `Unexpected channel "${pre1}" in version: "${version}"`
    );
  }

  const isUpdatable = channel !== 'adhoc';
  const isNightly = channel === 'alpha' || channel === 'axolotl';

  return {
    channel,
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prepatch,
    build: [...parsed.build],
    isUpdatable,
    isNightly,
  };
}
