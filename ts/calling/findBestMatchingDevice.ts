// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from 'ringrtc';
import { AudioDeviceModule } from './audioDeviceModule';

export function findBestMatchingAudioDeviceIndex({
  available,
  preferred,
  previousAudioDeviceModule,
  currentAudioDeviceModule,
}: Readonly<{
  available: ReadonlyArray<AudioDevice>;
  preferred: undefined | AudioDevice;
  previousAudioDeviceModule: AudioDeviceModule;
  currentAudioDeviceModule: AudioDeviceModule;
}>): undefined | number {
  if (!preferred) {
    return available.length > 0 ? 0 : undefined;
  }

  if (
    (currentAudioDeviceModule === AudioDeviceModule.WindowsAdm2 &&
      preferred.index === 0) ||
    (previousAudioDeviceModule === AudioDeviceModule.WindowsAdm2 &&
      preferred.index === 1 &&
      available.length >= 2)
  ) {
    return preferred.index;
  }

  if (preferred.uniqueId) {
    const idMatchIndex = available.findIndex(
      d => d.uniqueId === preferred.uniqueId
    );
    if (idMatchIndex !== -1) {
      return idMatchIndex;
    }
  }

  const nameMatchIndex = available.findIndex(d => d.name === preferred.name);
  if (nameMatchIndex !== -1) {
    return nameMatchIndex;
  }

  return available.length > 0 ? 0 : undefined;
}

export function findBestMatchingCameraId(
  available: ReadonlyArray<MediaDeviceInfo>,
  preferred?: string
): undefined | string {
  const matchingId = available.filter(d => d.deviceId === preferred);
  const nonInfrared = available.filter(d => !d.label.includes('IR Camera'));

  // By default, pick the first non-IR camera (but allow the user to pick the
  // infrared if they so desire)
  if (matchingId.length > 0) {
    return matchingId[0].deviceId;
  }
  if (nonInfrared.length > 0) {
    return nonInfrared[0].deviceId;
  }

  return undefined;
}
