// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevice, AudioDeviceList } from '@signalapp/ringrtc';
import type { AudioDevicePref } from '../types/Calling.std.ts';

// Try to get the relevant default device, falling back to the first device in the list
// if there is no OS-specified default.
//
// The fallback to the first device is arbitrary: there is no special semantic
// meaning to a device being first in the list. Instead, we assume that it's better
// to have a device available for a call than not to have any, so if there is no OS-specified
// default available, we select one of the non-default devices it provides, if there are any.
//
// On windows, |preferWindowsComms| defines whether to check the communications or console device first.
// Allows for the case of the preference being for a different OS than the OS we're running on
function defaultWithFallback(
  available: AudioDeviceList,
  preferWindowsComms = true
): AudioDevice | null {
  const { defaults } = available;
  const firstDevice = available.devices.at(0) ?? null;

  if (!defaults.isWindows) {
    return defaults.device ?? firstDevice ?? null;
  }

  const { communicationsDevice, consoleDevice } = defaults;

  if (preferWindowsComms) {
    return communicationsDevice ?? consoleDevice ?? firstDevice;
  }

  return consoleDevice ?? communicationsDevice ?? firstDevice;
}

export type FindBestMatchingAudioDeviceOptions = Readonly<{
  available: AudioDeviceList;
  preferred: AudioDevicePref;
}>;

/**
 * Caution: You probably **only** want to use this when you are about to hand
 * a specific device id to RingRTC. For any other UI purposes, hold on to the
 * AudioDevicePref, to distinguish to the user whether they have selected the
 * system default or a specific device
 */
export function findBestMatchingAudioDevice(
  options: FindBestMatchingAudioDeviceOptions
): AudioDevice | null {
  const { available, preferred } = options;

  if (preferred.type !== 'specificDevice') {
    return defaultWithFallback(
      available,
      preferred && preferred.type !== 'windowsConsole'
    );
  }

  if (preferred.device.uniqueId.length !== 0) {
    const idMatch = available.devices.find(device => {
      return device.uniqueId === preferred.device.uniqueId;
    });
    if (idMatch != null) {
      return idMatch;
    }
  }

  const nameMatch = available.devices.find(device => {
    return device.name === preferred.device.name;
  });

  if (nameMatch != null) {
    return nameMatch;
  }

  return defaultWithFallback(available);
}

export type FindBestMatchingCameraIdOptions = Readonly<{
  available: ReadonlyArray<MediaDeviceInfo>;
  preferred: string | null;
}>;

export function findBestMatchingCameraId(
  options: FindBestMatchingCameraIdOptions
): string | null {
  const { available, preferred } = options;
  const matchingId = available.filter(d => d.deviceId === preferred);
  const nonInfrared = available.filter(d => !d.label.includes('IR Camera'));

  // By default, pick the first non-IR camera (but allow the user to pick the
  // infrared if they so desire)
  return matchingId[0]?.deviceId ?? nonInfrared[0]?.deviceId ?? null;
}
