// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import os from 'node:os';
import fsExtra from 'fs-extra';
import { getOSFunctions } from './shared.std.js';

const { readFileSync } = fsExtra;

function getLinuxName(): string | undefined {
  if (os.platform() !== 'linux') {
    return undefined;
  }

  const etcOsRelease = readFileSync('/etc/os-release', 'utf-8');
  const match = etcOsRelease.match(/^PRETTY_NAME=(.+?)$/m);
  if (!match) {
    return undefined;
  }

  const name = match[1];
  if (isAppImage()) {
    return `${name} (AppImage)`;
  }
  // Flatpak is noted already in /etc/os-release

  return name;
}

function isAppImage(): boolean {
  return process.platform === 'linux' && process.env.APPIMAGE != null;
}

function isFlatpak(): boolean {
  if (process.env.container === 'flatpak') {
    return true;
  }

  const linuxName = getLinuxName();
  if (linuxName && linuxName.toLowerCase().includes('flatpak')) {
    return true;
  }

  return false;
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
  isAppImage,
  isFlatpak,
  isLinuxUsingKDE,
  isWaylandEnabled,
};

export default OS;
