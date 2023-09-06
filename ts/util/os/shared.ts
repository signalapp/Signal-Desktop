// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';
import { readFileSync } from 'fs-extra';

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
  hasCustomTitleBar: () => boolean;
  isLinux: (minVersion?: string) => boolean;
  isMacOS: (minVersion?: string) => boolean;
  isWindows: (minVersion?: string) => boolean;
  getLinuxName: () => string | undefined;
};

export function getOSFunctions(osRelease: string): OSType {
  const isMacOS = createIsPlatform('darwin', osRelease);
  const isLinux = createIsPlatform('linux', osRelease);
  const isWindows = createIsPlatform('win32', osRelease);

  // Windows 10 and above
  const hasCustomTitleBar = (): boolean =>
    isWindows('10.0.0') || Boolean(process.env.CUSTOM_TITLEBAR);

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

  const getLinuxName = (): string | undefined => {
    if (!isLinux()) {
      return undefined;
    }

    const etcOsRelease = readFileSync('/etc/os-release', 'utf-8');
    const match = etcOsRelease.match(/^PRETTY_NAME=(.+?)$/m);
    if (!match) {
      return undefined;
    }

    return match[1];
  };

  return {
    getClassName,
    getName,
    hasCustomTitleBar,
    isLinux,
    isMacOS,
    isWindows,
    getLinuxName,
  };
}
