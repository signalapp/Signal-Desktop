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
