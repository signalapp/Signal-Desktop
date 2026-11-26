// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { BrowserAudioDevice } from '../../calling/findBrowserAudioDevice.std.ts';
import {
  findBrowserAudioDeviceId,
  getPeakAudioLevel,
} from '../../calling/findBrowserAudioDevice.std.ts';
import type { AudioDevicePref } from '../../types/Calling.std.ts';

function input(deviceId: string, label: string): BrowserAudioDevice {
  return { deviceId, label, kind: 'audioinput' };
}

function output(deviceId: string, label: string): BrowserAudioDevice {
  return { deviceId, label, kind: 'audiooutput' };
}

function specific(name: string): AudioDevicePref {
  return {
    type: 'specificDevice',
    device: { name, uniqueId: `ringrtc-${name}` },
  };
}

const browserDevices: ReadonlyArray<BrowserAudioDevice> = [
  input('default', 'Default - Yeti Stereo Microphone (046d:0aaf)'),
  input('communications', 'Communications - Headset Microphone'),
  input('mic-yeti', 'Yeti Stereo Microphone (046d:0aaf)'),
  input('mic-headset', 'Headset Microphone'),
  input('mic-builtin', 'MacBook Pro Microphone'),
  output('default', 'Default - MacBook Pro Speakers'),
  output('speaker-builtin', 'MacBook Pro Speakers'),
  output('speaker-headset', 'Headset Earphone'),
];

describe('findBrowserAudioDeviceId', () => {
  it('uses the browser default for non-specific preferences', () => {
    for (const type of ['nonWindowsDefault', 'windowsConsole'] as const) {
      assert.deepEqual(
        findBrowserAudioDeviceId({
          kind: 'audioinput',
          preferred: { type },
          browserDevices,
        }),
        { deviceId: undefined, isFallback: false }
      );
    }
  });

  it('uses the communications device if available and preferred', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: { type: 'windowsCommunications' },
        browserDevices,
      }),
      { deviceId: 'communications', isFallback: false }
    );
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audiooutput',
        preferred: { type: 'windowsCommunications' },
        browserDevices,
      }),
      { deviceId: undefined, isFallback: false }
    );
  });

  it('matches a specific device by exact name', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('MacBook Pro Microphone'),
        browserDevices,
      }),
      { deviceId: 'mic-builtin', isFallback: false }
    );
  });

  it('only matches devices of the requested kind', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audiooutput',
        preferred: specific('MacBook Pro Speakers'),
        browserDevices,
      }),
      { deviceId: 'speaker-builtin', isFallback: false }
    );
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audiooutput',
        preferred: specific('MacBook Pro Microphone'),
        browserDevices,
      }),
      { deviceId: undefined, isFallback: true }
    );
  });

  it('ignores USB ids and case in labels', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('yeti stereo microphone'),
        browserDevices,
      }),
      { deviceId: 'mic-yeti', isFallback: false }
    );
  });

  it('accepts a single partial match', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audiooutput',
        preferred: specific('Headset Earphone (Bluetooth)'),
        browserDevices,
      }),
      { deviceId: 'speaker-headset', isFallback: false }
    );
  });

  it('does not guess between several partial matches', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('Microphone'),
        browserDevices,
      }),
      { deviceId: undefined, isFallback: true }
    );
  });

  it('never matches the default/communications pseudo devices', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('Communications - Headset Microphone'),
        browserDevices,
      }),
      { deviceId: 'mic-headset', isFallback: false }
    );
  });

  it('falls back to the default if the device is missing or labels are hidden', () => {
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('USB Audio Interface'),
        browserDevices,
      }),
      { deviceId: undefined, isFallback: true }
    );
    assert.deepEqual(
      findBrowserAudioDeviceId({
        kind: 'audioinput',
        preferred: specific('MacBook Pro Microphone'),
        browserDevices: [input('abc', ''), input('def', '')],
      }),
      { deviceId: undefined, isFallback: true }
    );
  });
});

describe('getPeakAudioLevel', () => {
  it('returns 0 for silence or an empty buffer', () => {
    assert.strictEqual(getPeakAudioLevel(new Float32Array(0)), 0);
    assert.strictEqual(getPeakAudioLevel(new Float32Array(128)), 0);
  });

  it('returns the largest absolute sample', () => {
    assert.closeTo(
      getPeakAudioLevel(Float32Array.from([0.1, -0.6, 0.3])),
      0.6,
      1e-6
    );
  });

  it('clamps clipped samples to 1', () => {
    assert.strictEqual(getPeakAudioLevel(Float32Array.from([1.5, -2])), 1);
  });
});
