// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'os';
import { readFileSync } from 'fs-extra';
import { getOSFunctions } from './shared';

function getLinuxName(): string | undefined {
  if (os.platform() !== 'linux') {
    return undefined;
  }

  const etcOsRelease = readFileSync('/etc/os-release', 'utf-8');
  const match = etcOsRelease.match(/^PRETTY_NAME=(.+?)$/m);
  if (!match) {
    return undefined;
  }

  return match[1];
}

const OS = {
  ...getOSFunctions(os.release()),
  getLinuxName,
};

export default OS;
