// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as semver from 'semver';

export const isProduction = (version: string): boolean => {
  const parsed = semver.parse(version);

  if (!parsed) {
    return false;
  }

  return !parsed.prerelease.length && !parsed.build.length;
};

export const isBeta = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'beta';

export const isNightly = (version: string): boolean =>
  isAlpha(version) || isAxolotl(version);

export const isAlpha = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'alpha';

export const isAxolotl = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'axolotl';

export const isAdhoc = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'adhoc';

export const isNotUpdatable = (version: string): boolean => isAdhoc(version);

export const isStaging = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'staging';

export const generateTaggedVersion = (options: {
  release: string;
  currentVersion: string;
  shortSha: string;
}): string => {
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
};
