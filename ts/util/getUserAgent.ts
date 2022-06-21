// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';

import { getOwn } from './getOwn';

const PLATFORM_STRINGS: { [platform: string]: string } = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
};

export function getUserAgent(
  appVersion: string,
  release = os.release()
): string {
  // `process.platform` could be missing if someone figures out how to compile Signal on
  //   an unsupported OS and forgets to update this file. We'd rather send nothing than
  //   crash.
  const platformString = getOwn(PLATFORM_STRINGS, process.platform);

  let result = `Signal-Desktop/${appVersion}`;
  if (platformString) {
    result += ` ${platformString} ${release}`;
  }

  return result;
}
