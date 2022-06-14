// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as semver from 'semver';
import moment from 'moment';

export const isProduction = (version: string): boolean => {
  const parsed = semver.parse(version);

  if (!parsed) {
    return false;
  }

  return !parsed.prerelease.length && !parsed.build.length;
};

export const isBeta = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'beta';

export const isAlpha = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'alpha';

export const isStaging = (version: string): boolean =>
  semver.parse(version)?.prerelease[0] === 'staging';

export const generateAlphaVersion = (options: {
  currentVersion: string;
  shortSha: string;
}): string => {
  const { currentVersion, shortSha } = options;

  const parsed = semver.parse(currentVersion);
  if (!parsed) {
    throw new Error(`generateAlphaVersion: Invalid version ${currentVersion}`);
  }

  const formattedDate = moment().utc().format('YYYYMMDD.HH');
  const formattedVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;

  return `${formattedVersion}-alpha.${formattedDate}-${shortSha}`;
};
