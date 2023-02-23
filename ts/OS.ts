// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { release as osRelease } from 'os';
import semver from 'semver';

const createIsPlatform = (
  platform: typeof process.platform
): ((minVersion?: string) => boolean) => {
  return minVersion => {
    if (process.platform !== platform) {
      return false;
    }
    if (minVersion === undefined) {
      return true;
    }

    return semver.gte(osRelease(), minVersion);
  };
};

export const isMacOS = createIsPlatform('darwin');
export const isLinux = createIsPlatform('linux');
export const isWindows = createIsPlatform('win32');

// Windows 10 and above
export const hasCustomTitleBar = (): boolean =>
  isWindows('10.0.0') || Boolean(process.env.CUSTOM_TITLEBAR);

export const getName = (): string => {
  if (isMacOS()) {
    return 'macOS';
  }
  if (isWindows()) {
    return 'Windows';
  }
  return 'Linux';
};

export const getClassName = (): string => {
  if (isMacOS()) {
    return 'os-macos';
  }
  if (isWindows()) {
    return 'os-windows';
  }
  return 'os-linux';
};
