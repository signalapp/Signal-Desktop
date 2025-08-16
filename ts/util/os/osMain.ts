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

function isWaylandEnabled(): boolean {
  return Boolean(process.env.WAYLAND_DISPLAY);
}

function isLinuxUsingKDE(): boolean {
  return os.platform() === 'linux' && process.env.XDG_CURRENT_DESKTOP === 'KDE';
}

const OS = {
  ...getOSFunctions(os.release()),
  getLinuxName,
  isLinuxUsingKDE,
  isWaylandEnabled,
};

export default OS;
