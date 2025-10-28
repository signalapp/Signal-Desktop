// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

function createIsPlatform(
  platform: typeof process.platform,
  osRelease: string
): (minVersion?: string) => boolean {
  return minVersion => {
    if (process.platform !== platform) {
      return false;
    }
    if (minVersion === undefined) {
      return true;
    }

    return semver.gte(osRelease, minVersion);
  };
}

export type OSType = {
  getClassName: () => string;
  getName: () => string;
  isLinux: (minVersion?: string) => boolean;
  isMacOS: (minVersion?: string) => boolean;
  isWindows: (minVersion?: string) => boolean;
};

export function getOSFunctions(osRelease: string): OSType {
  const isMacOS = createIsPlatform('darwin', osRelease);
  const isLinux = createIsPlatform('linux', osRelease);
  const isWindows = createIsPlatform('win32', osRelease);

  const getName = (): string => {
    if (isMacOS()) {
      return 'macOS';
    }
    if (isWindows()) {
      return 'Windows';
    }
    return 'Linux';
  };

  const getClassName = (): string => {
    if (isMacOS()) {
      return 'os-macos';
    }
    if (isWindows()) {
      return 'os-windows';
    }
    return 'os-linux';
  };

  return {
    getClassName,
    getName,
    isLinux,
    isMacOS,
    isWindows,
  };
}
