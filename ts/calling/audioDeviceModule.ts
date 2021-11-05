// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum';
import { isEnabled } from '../RemoteConfig';
import { isAlpha, isBeta } from '../util/version';
import * as OS from '../OS';

export enum AudioDeviceModule {
  Default = 'Default',
  WindowsAdm2 = 'WindowsAdm2',
}

export const parseAudioDeviceModule = makeEnumParser(
  AudioDeviceModule,
  AudioDeviceModule.Default
);

export function getAudioDeviceModule(): AudioDeviceModule {
  if (!OS.isWindows()) {
    return AudioDeviceModule.Default;
  }

  const appVersion = window.getVersion();
  if (
    isEnabled('desktop.calling.useWindowsAdm2') ||
    isBeta(appVersion) ||
    isAlpha(appVersion)
  ) {
    return AudioDeviceModule.WindowsAdm2;
  }

  return AudioDeviceModule.Default;
}
