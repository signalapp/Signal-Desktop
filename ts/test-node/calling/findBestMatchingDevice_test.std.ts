// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { findBestMatchingAudioDevice } from '../../calling/findBestMatchingDevice.std.ts';
import { getEmptyAudioDeviceList } from '../../types/Calling.std.ts';
import type { AudioDevicePref } from '../../types/Calling.std.ts';
import type { AudioDevice } from '@signalapp/ringrtc';

describe('"find best matching device" helpers', () => {
  describe('findBestMatchingAudioDeviceIndex', () => {
    describe('find best matching device', () => {
      it('returns null if no devices are available', () => {
        const prefs: Array<AudioDevicePref> = [
          {
            type: 'specificDevice',
            device: { name: 'Big Microphone', uniqueId: 'abc123' },
          },
        ];

        prefs.forEach(preferred => {
          const result = findBestMatchingAudioDevice({
            available: getEmptyAudioDeviceList(false),
            preferred,
          });

          assert.isNull(result);
        });
      });

      it('returns default if that was the previous preference (and a device is available)', () => {
        const defaultDevice: AudioDevice = {
          name: 'D',
          uniqueId: 'device-D',
        };

        const result = findBestMatchingAudioDevice({
          // Note that the default isn't necessarily in the available.devices list!
          available: {
            devices: [
              { name: 'A', uniqueId: 'device-A' },
              { name: 'B', uniqueId: 'device-B' },
              { name: 'C', uniqueId: 'device-C' },
            ],
            defaults: {
              isWindows: false,
              device: defaultDevice,
            },
          },
          preferred: { type: 'nonWindowsDefault' },
        });

        assert.deepEqual(result, defaultDevice);
      });

      it('returns communications default if that was the previous preference (and a device is available)', () => {
        const comms: AudioDevice = { name: 'A', uniqueId: 'device-A' };
        const console: AudioDevice = { name: 'B', uniqueId: 'device-B' };

        const result = findBestMatchingAudioDevice({
          available: {
            devices: [comms, console, { name: 'C', uniqueId: 'device-C' }],
            defaults: {
              isWindows: true,
              communicationsDevice: comms,
              consoleDevice: console,
            },
          },
          preferred: { type: 'windowsCommunications' },
        });

        assert.deepEqual(result, comms);
      });

      it('returns console default if that was the previous preference (and a device is available)', () => {
        const comms: AudioDevice = { name: 'A', uniqueId: 'device-A' };
        const console: AudioDevice = { name: 'B', uniqueId: 'device-B' };

        const result = findBestMatchingAudioDevice({
          available: {
            devices: [comms, console, { name: 'C', uniqueId: 'device-C' }],
            defaults: {
              isWindows: true,
              communicationsDevice: comms,
              consoleDevice: console,
            },
          },
          preferred: { type: 'windowsConsole' },
        });

        assert.deepEqual(result, console);
      });

      it('returns a unique ID match if it exists and the preferred index is not 0 or 1', () => {
        const matchId = 'device-C';
        const match: AudioDevice = { name: 'C', uniqueId: matchId };

        const result = findBestMatchingAudioDevice({
          available: {
            devices: [
              { name: 'A', uniqueId: 'device-A' },
              { name: 'B', uniqueId: 'device-B' },
              match,
            ],
            defaults: { isWindows: false, device: undefined },
          },
          preferred: {
            type: 'specificDevice',
            device: { name: 'Ignored', uniqueId: matchId },
          },
        });

        assert.deepEqual(result, match);
      });

      it('returns a name match if it exists and the preferred index is not 0 or 1', () => {
        const matchName = 'C';
        const match: AudioDevice = { name: matchName, uniqueId: 'device-C' };

        const result = findBestMatchingAudioDevice({
          available: {
            devices: [
              { name: 'A', uniqueId: 'device-A' },
              { name: 'B', uniqueId: 'device-B' },
              match,
            ],
            defaults: { isWindows: false, device: undefined },
          },
          preferred: {
            type: 'specificDevice',
            device: { name: matchName, uniqueId: 'Ignored' },
          },
        });

        assert.deepEqual(result, match);
      });

      describe('default fallback', () => {
        const DEVICE_A: AudioDevice = { name: 'A', uniqueId: 'device-A' };
        const DEVICE_B: AudioDevice = { name: 'B', uniqueId: 'device-B' };
        const DEVICE_C: AudioDevice = { name: 'C', uniqueId: 'device-C' };

        it('returns the system default device if the preferred device is not found', () => {
          const systemDefault = DEVICE_B;

          const result = findBestMatchingAudioDevice({
            available: {
              devices: [DEVICE_A, systemDefault, DEVICE_C],
              defaults: {
                isWindows: false,
                device: systemDefault,
              },
            },
            preferred: {
              type: 'specificDevice',
              device: { name: 'X', uniqueId: 'Y' },
            },
          });

          assert.deepEqual(result, systemDefault);
        });

        it('returns the default communications device if the preferred device is not found for windows', () => {
          const comms = DEVICE_B;
          const console = DEVICE_C;

          const result = findBestMatchingAudioDevice({
            available: {
              devices: [DEVICE_A, comms, console],
              defaults: {
                isWindows: true,
                communicationsDevice: comms,
                consoleDevice: console,
              },
            },
            preferred: {
              type: 'specificDevice',
              device: { name: 'X', uniqueId: 'Y' },
            },
          });

          assert.deepEqual(result, comms);
        });
      });
    });
  });
});
