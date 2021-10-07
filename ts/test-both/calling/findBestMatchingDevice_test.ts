// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { AudioDeviceModule } from '../../calling/audioDeviceModule';

import { findBestMatchingAudioDeviceIndex } from '../../calling/findBestMatchingDevice';

describe('"find best matching device" helpers', () => {
  describe('findBestMatchingAudioDeviceIndex', () => {
    type AdmOptionsType = Readonly<{
      previousAudioDeviceModule: AudioDeviceModule;
      currentAudioDeviceModule: AudioDeviceModule;
    }>;

    const itReturnsUndefinedIfNoDevicesAreAvailable = (
      admOptions: AdmOptionsType
    ) => {
      it('returns undefined if no devices are available', () => {
        [
          undefined,
          { name: 'Big Microphone', index: 1, uniqueId: 'abc123' },
        ].forEach(preferred => {
          assert.isUndefined(
            findBestMatchingAudioDeviceIndex({
              available: [],
              preferred,
              ...admOptions,
            })
          );
        });
      });
    };

    const itReturnsTheFirstAvailableDeviceIfNoneIsPreferred = (
      admOptions: AdmOptionsType
    ) => {
      it('returns the first available device if none is preferred', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex({
            available: [
              { name: 'A', index: 123, uniqueId: 'device-A' },
              { name: 'B', index: 456, uniqueId: 'device-B' },
              { name: 'C', index: 789, uniqueId: 'device-C' },
            ],
            preferred: undefined,
            ...admOptions,
          }),
          0
        );
      });
    };

    const testUniqueIdMatch = (admOptions: AdmOptionsType) => {
      assert.strictEqual(
        findBestMatchingAudioDeviceIndex({
          available: [
            { name: 'A', index: 123, uniqueId: 'device-A' },
            { name: 'B', index: 456, uniqueId: 'device-B' },
            { name: 'C', index: 789, uniqueId: 'device-C' },
          ],
          preferred: { name: 'Ignored', index: 99, uniqueId: 'device-C' },
          ...admOptions,
        }),
        2
      );
    };

    const testNameMatch = (admOptions: AdmOptionsType) => {
      assert.strictEqual(
        findBestMatchingAudioDeviceIndex({
          available: [
            { name: 'A', index: 123, uniqueId: 'device-A' },
            { name: 'B', index: 456, uniqueId: 'device-B' },
            { name: 'C', index: 789, uniqueId: 'device-C' },
          ],
          preferred: { name: 'C', index: 99, uniqueId: 'ignored' },
          ...admOptions,
        }),
        2
      );
    };

    const itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound = (
      admOptions: AdmOptionsType
    ) => {
      it('returns the first available device if the preferred device is not found', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex({
            available: [
              { name: 'A', index: 123, uniqueId: 'device-A' },
              { name: 'B', index: 456, uniqueId: 'device-B' },
              { name: 'C', index: 789, uniqueId: 'device-C' },
            ],
            preferred: { name: 'X', index: 123, uniqueId: 'Y' },
            ...admOptions,
          }),
          0
        );
      });
    };

    describe('with default audio device module', () => {
      const admOptions = {
        previousAudioDeviceModule: AudioDeviceModule.Default,
        currentAudioDeviceModule: AudioDeviceModule.Default,
      };

      itReturnsUndefinedIfNoDevicesAreAvailable(admOptions);

      itReturnsTheFirstAvailableDeviceIfNoneIsPreferred(admOptions);

      it('returns a unique ID match if it exists', () => {
        testUniqueIdMatch(admOptions);
      });

      it('returns a name match if it exists', () => {
        testNameMatch(admOptions);
      });

      itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound(
        admOptions
      );
    });

    describe('when going from the default to Windows ADM2', () => {
      const admOptions = {
        previousAudioDeviceModule: AudioDeviceModule.Default,
        currentAudioDeviceModule: AudioDeviceModule.WindowsAdm2,
      };

      itReturnsUndefinedIfNoDevicesAreAvailable(admOptions);

      itReturnsTheFirstAvailableDeviceIfNoneIsPreferred(admOptions);

      it('returns 0 if that was the previous preferred index (and a device is available)', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex({
            available: [
              { name: 'A', index: 123, uniqueId: 'device-A' },
              { name: 'B', index: 456, uniqueId: 'device-B' },
            ],
            preferred: { name: 'B', index: 0, uniqueId: 'device-B' },
            ...admOptions,
          }),
          0
        );
      });

      it('returns a unique ID match if it exists and the preferred index is not 0', () => {
        testUniqueIdMatch(admOptions);
      });

      it('returns a name match if it exists and the preferred index is not 0', () => {
        testNameMatch(admOptions);
      });

      itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound(
        admOptions
      );
    });

    describe('when going "backwards" from Windows ADM2 to the default', () => {
      const admOptions = {
        previousAudioDeviceModule: AudioDeviceModule.WindowsAdm2,
        currentAudioDeviceModule: AudioDeviceModule.Default,
      };

      itReturnsUndefinedIfNoDevicesAreAvailable(admOptions);

      itReturnsTheFirstAvailableDeviceIfNoneIsPreferred(admOptions);

      it('returns a unique ID match if it exists', () => {
        testUniqueIdMatch(admOptions);
      });

      it('returns a name match if it exists', () => {
        testNameMatch(admOptions);
      });

      itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound(
        admOptions
      );
    });

    describe('with Windows ADM2', () => {
      const admOptions = {
        previousAudioDeviceModule: AudioDeviceModule.WindowsAdm2,
        currentAudioDeviceModule: AudioDeviceModule.WindowsAdm2,
      };

      itReturnsUndefinedIfNoDevicesAreAvailable(admOptions);

      itReturnsTheFirstAvailableDeviceIfNoneIsPreferred(admOptions);

      [0, 1].forEach(index => {
        it(`returns ${index} if that was the previous preferred index (and a device is available)`, () => {
          assert.strictEqual(
            findBestMatchingAudioDeviceIndex({
              available: [
                { name: 'A', index: 123, uniqueId: 'device-A' },
                { name: 'B', index: 456, uniqueId: 'device-B' },
                { name: 'C', index: 789, uniqueId: 'device-C' },
              ],
              preferred: { name: 'C', index, uniqueId: 'device-C' },
              ...admOptions,
            }),
            index
          );
        });
      });

      it("returns 0 if the previous preferred index was 1 but there's only 1 audio device", () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex({
            available: [{ name: 'A', index: 123, uniqueId: 'device-A' }],
            preferred: { name: 'C', index: 1, uniqueId: 'device-C' },
            ...admOptions,
          }),
          0
        );
      });

      it('returns a unique ID match if it exists and the preferred index is not 0 or 1', () => {
        testUniqueIdMatch(admOptions);
      });

      it('returns a name match if it exists and the preferred index is not 0 or 1', () => {
        testNameMatch(admOptions);
      });

      itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound(
        admOptions
      );
    });
  });
});
