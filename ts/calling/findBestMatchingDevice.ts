// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice } from '@signalapp/ringrtc';

export function findBestMatchingAudioDeviceIndex(
  {
    available,
    preferred,
  }: Readonly<{
    available: ReadonlyArray<AudioDevice>;
    preferred: undefined | AudioDevice;
  }>,
  isWindows: boolean
): undefined | number {
  if (!preferred) {
    return available.length > 0 ? 0 : undefined;
  }

  // On Linux and Mac, the default device is at index 0.
  // On Windows, there are two default devices, as presented by RingRTC:
  // * The default communications device (for voice calls, at index 0)
  // * the default device (for, e.g., media, at index 1)
  if (
    preferred.index === 0 ||
    (isWindows && preferred.index === 1 && available.length >= 2)
  ) {
    return preferred.index;
  }

  // Number of default devices at start of list to ignore.
  const offset = isWindows ? 2 : 1;
  const searchArr = available.slice(offset);

  if (preferred.uniqueId) {
    const idMatchIndex = searchArr.findIndex(
      d => d.uniqueId === preferred.uniqueId
    );
    if (idMatchIndex !== -1) {
      return idMatchIndex + offset;
    }
  }

  const nameMatchIndex = searchArr.findIndex(d => d.name === preferred.name);
  if (nameMatchIndex !== -1) {
    return nameMatchIndex + offset;
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
