// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { version as osVersion } from 'os';

import type { LoggerType } from '../types/Logging';

const MIN_UBUNTU_VERSION = '16.04';

export function getUbuntuVersion(): string | undefined {
  if (process.platform !== 'linux') {
    return undefined;
  }

  const match = osVersion().match(/^#\d+~([\d.]+)-Ubuntu\s/);
  if (!match) {
    return undefined;
  }

  return match[1];
}

export function isLinuxVersionSupported(logger?: LoggerType): boolean {
  const ubuntu = getUbuntuVersion();
  if (ubuntu !== undefined && ubuntu < MIN_UBUNTU_VERSION) {
    logger?.warn(
      `updater/isLinuxVersionSupported: unsupported Ubuntu version ${ubuntu}`
    );
    return false;
  }

  return true;
}
