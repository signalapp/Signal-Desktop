// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { makeEnumParser } from '../util/enum';

export enum AudioDeviceModule {
  Default = 'Default',
  WindowsAdm2 = 'WindowsAdm2',
}

export const parseAudioDeviceModule = makeEnumParser(
  AudioDeviceModule,
  AudioDeviceModule.Default
);
