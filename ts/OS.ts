// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import is from '@sindresorhus/is';
import os from 'os';
import semver from 'semver';

export const isMacOS = (): boolean => process.platform === 'darwin';
export const isLinux = (): boolean => process.platform === 'linux';
export const isWindows = (minVersion?: string): boolean => {
  const osRelease = os.release();

  if (process.platform !== 'win32') {
    return false;
  }

  return is.undefined(minVersion) ? true : semver.gte(osRelease, minVersion);
};
