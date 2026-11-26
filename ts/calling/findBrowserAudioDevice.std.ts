// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AudioDevicePref } from '../types/Calling.std.ts';

// Chromium exposes these pseudo-devices in addition to the real ones
const BROWSER_DEFAULT_DEVICE_ID = 'default';
const BROWSER_COMMUNICATIONS_DEVICE_ID = 'communications';

export type BrowserAudioDevice = Pick<
  MediaDeviceInfo,
  'deviceId' | 'label' | 'kind'
>;

export type FindBrowserAudioDeviceIdOptions = Readonly<{
  kind: 'audioinput' | 'audiooutput';
  preferred: AudioDevicePref;
  browserDevices: ReadonlyArray<BrowserAudioDevice>;
}>;

export type FindBrowserAudioDeviceIdResult = Readonly<{
  // `undefined` means "use the browser's default device"
  deviceId: string | undefined;
  // True if the user picked a specific device that we couldn't find in the
  // list of devices exposed by the browser.
  isFallback: boolean;
}>;

function isPseudoDevice(device: BrowserAudioDevice): boolean {
  return (
    device.deviceId === BROWSER_DEFAULT_DEVICE_ID ||
    device.deviceId === BROWSER_COMMUNICATIONS_DEVICE_ID
  );
}

// Chromium appends USB vendor/product ids to some labels, e.g.
// "Yeti Stereo Microphone (046d:0aaf)"
function normalizeLabel(label: string): string {
  return label
    .replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * RingRTC and Chromium enumerate audio devices independently and use
 * different ids, so the device selected in Settings (a RingRTC device) has to
 * be mapped to a browser device by name before it can be used with
 * `getUserMedia()` or `HTMLMediaElement.setSinkId()`.
 *
 * See also ts/calling/findBestMatchingDevice.std.ts
 */
export function findBrowserAudioDeviceId(
  options: FindBrowserAudioDeviceIdOptions
): FindBrowserAudioDeviceIdResult {
  const { kind, preferred } = options;
  const browserDevices = options.browserDevices.filter(
    device => device.kind === kind
  );

  if (preferred.type !== 'specificDevice') {
    if (
      preferred.type === 'windowsCommunications' &&
      browserDevices.some(
        device => device.deviceId === BROWSER_COMMUNICATIONS_DEVICE_ID
      )
    ) {
      return { deviceId: BROWSER_COMMUNICATIONS_DEVICE_ID, isFallback: false };
    }
    return { deviceId: undefined, isFallback: false };
  }

  const realDevices = browserDevices.filter(
    device => !isPseudoDevice(device) && device.label.length !== 0
  );
  const { name } = preferred.device;

  const exactMatch = realDevices.find(device => device.label === name);
  if (exactMatch != null) {
    return { deviceId: exactMatch.deviceId, isFallback: false };
  }

  const normalizedName = normalizeLabel(name);
  if (normalizedName.length !== 0) {
    const normalizedMatch = realDevices.find(
      device => normalizeLabel(device.label) === normalizedName
    );
    if (normalizedMatch != null) {
      return { deviceId: normalizedMatch.deviceId, isFallback: false };
    }

    const partialMatches = realDevices.filter(device => {
      const label = normalizeLabel(device.label);
      return label.includes(normalizedName) || normalizedName.includes(label);
    });
    if (partialMatches.length === 1) {
      return { deviceId: partialMatches[0]?.deviceId, isFallback: false };
    }
  }

  return { deviceId: undefined, isFallback: true };
}

/**
 * Returns the peak amplitude (0 to 1) of a buffer of time domain samples, as
 * returned by `AnalyserNode.getFloatTimeDomainData()`.
 */
export function getPeakAudioLevel(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) {
    const value = Math.abs(sample);
    if (value > peak) {
      peak = value;
    }
  }
  return Math.min(peak, 1);
}
