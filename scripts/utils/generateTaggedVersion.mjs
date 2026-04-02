// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import * as semver from 'semver';

/**
 * @typedef {{
 *   release: string;
 *   currentVersion: string;
 *   shortSha: string;
 * }} Options
 */

/**
 * @param {Options} options
 * @returns {string}
 */
export function generateTaggedVersion(options) {
  const { release, currentVersion, shortSha } = options;

  const parsed = semver.parse(currentVersion);
  if (!parsed) {
    throw new Error(`generateTaggedVersion: Invalid version ${currentVersion}`);
  }

  const dateTimeParts = new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    timeZone: 'GMT',
    year: 'numeric',
  }).formatToParts(new Date());
  const dateTimeMap = new Map();
  dateTimeParts.forEach(({ type, value }) => {
    dateTimeMap.set(type, value);
  });
  const formattedDate = `${dateTimeMap.get('year')}${dateTimeMap.get(
    'month'
  )}${dateTimeMap.get('day')}.${dateTimeMap.get('hour')}`;

  const formattedVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;

  return `${formattedVersion}-${release}.${formattedDate}-${shortSha}`;
}
