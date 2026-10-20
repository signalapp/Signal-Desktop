// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { findBestMatchingAudioDevice } from '../../calling/findBestMatchingDevice.std.ts';
import { getEmptyAudioDeviceList } from '../../types/Calling.std.ts';
import type { AudioDevicePref } from '../../types/Calling.std.ts';

describe('"find best matching device" helpers', () => {
  describe('findBestMatchingAudioDeviceIndex', () => {
    const itReturnsUndefinedIfNoDevicesAreAvailable = () => {
      it('returns undefined if no devices are available', () => {
        const prefs: Array<AudioDevicePref> = [
          {
            type: 'specificDevice',
            device: { name: 'Big Microphone', uniqueId: 'abc123' },
          },
        ];
        prefs.forEach(preferred => {
          assert.isUndefined(
            findBestMatchingAudioDevice({
              available: getEmptyAudioDeviceList(false),
              preferred,
            })
          );
        });
      });
    };

    const testUniqueIdMatch = () => {
      assert.deepEqual(
        findBestMatchingAudioDevice({
          available: {
            devices: [
              { name: 'A', uniqueId: 'device-A' },
              { name: 'B', uniqueId: 'device-B' },
              { name: 'C', uniqueId: 'device-C' },
            ],
            defaults: { isWindows: false, device: undefined },
          },
          preferred: {
            type: 'specificDevice',
            device: { name: 'Ignored', uniqueId: 'device-C' },
          },
        }),
        { name: 'C', uniqueId: 'device-C' }
      );
    };

    const testNameMatch = () => {
      assert.deepEqual(
        findBestMatchingAudioDevice({
          available: {
            devices: [
              { name: 'A', uniqueId: 'device-A' },
              { name: 'B', uniqueId: 'device-B' },
              { name: 'C', uniqueId: 'device-C' },
            ],
            defaults: { isWindows: false, device: undefined },
          },
          preferred: {
            type: 'specificDevice',
            device: { name: 'C', uniqueId: 'Ignored' },
          },
        }),
        { name: 'C', uniqueId: 'device-C' }
      );
    };

    const itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound =
      () => {
        const list = [
          { name: 'A', uniqueId: 'device-A' },
          { name: 'B', uniqueId: 'device-B' },
          { name: 'C', uniqueId: 'device-C' },
        ];
        it('returns the system default device if the preferred device is not found', () => {
          assert.deepEqual(
            findBestMatchingAudioDevice({
              available: {
                devices: list,
                defaults: {
                  isWindows: false,
                  device: { name: 'B', uniqueId: 'device-B' },
                },
              },
              preferred: {
                type: 'specificDevice',
                device: { name: 'X', uniqueId: 'Y' },
              },
            }),
            list[1]
          );
        });
        it('returns the default communications device if the preferred device is not found for windows', () => {
          assert.deepEqual(
            findBestMatchingAudioDevice({
              available: {
                devices: list,
                defaults: {
                  isWindows: true,
                  communicationsDevice: { name: 'B', uniqueId: 'device-B' },
                  consoleDevice: { name: 'C', uniqueId: 'device-C' },
                },
              },
              preferred: {
                type: 'specificDevice',
                device: { name: 'X', uniqueId: 'Y' },
              },
            }),
            list[1]
          );
        });
      };

    describe('find best matching device', () => {
      itReturnsUndefinedIfNoDevicesAreAvailable();

      it('returns default if that was the previous preference (and a device is available)', () => {
        assert.deepEqual(
          findBestMatchingAudioDevice({
            // Note that the default isn't necessarily in the available.devices list!
            available: {
              devices: [
                { name: 'A', uniqueId: 'device-A' },
                { name: 'B', uniqueId: 'device-B' },
                { name: 'C', uniqueId: 'device-C' },
              ],
              defaults: {
                isWindows: false,
                device: { name: 'D', uniqueId: 'device-D' },
              },
            },
            preferred: { type: 'nonWindowsDefault' },
          }),
          { name: 'D', uniqueId: 'device-D' }
        );
      });
      it('returns communications default if that was the previous preference (and a device is available)', () => {
        assert.deepEqual(
          findBestMatchingAudioDevice({
            available: {
              devices: [
                { name: 'A', uniqueId: 'device-A' },
                { name: 'B', uniqueId: 'device-B' },
                { name: 'C', uniqueId: 'device-C' },
              ],
              defaults: {
                isWindows: true,
                communicationsDevice: { name: 'A', uniqueId: 'device-A' },
                consoleDevice: { name: 'B', uniqueId: 'device-B' },
              },
            },
            preferred: { type: 'windowsCommunications' },
          }),
          { name: 'A', uniqueId: 'device-A' }
        );
      });
      it('returns console default if that was the previous preference (and a device is available)', () => {
        assert.deepEqual(
          findBestMatchingAudioDevice({
            available: {
              devices: [
                { name: 'A', uniqueId: 'device-A' },
                { name: 'B', uniqueId: 'device-B' },
                { name: 'C', uniqueId: 'device-C' },
              ],
              defaults: {
                isWindows: true,
                communicationsDevice: { name: 'A', uniqueId: 'device-A' },
                consoleDevice: { name: 'B', uniqueId: 'device-B' },
              },
            },
            preferred: { type: 'windowsConsole' },
          }),
          { name: 'B', uniqueId: 'device-B' }
        );
      });

      it('returns a unique ID match if it exists and the preferred index is not 0 or 1', () => {
        testUniqueIdMatch();
      });

      it('returns a name match if it exists and the preferred index is not 0 or 1', () => {
        testNameMatch();
      });

      itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound();
    });
  });
});
