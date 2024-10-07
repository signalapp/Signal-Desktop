// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { findBestMatchingAudioDeviceIndex } from '../../calling/findBestMatchingDevice';

describe('"find best matching device" helpers', () => {
  describe('findBestMatchingAudioDeviceIndex', () => {
    const itReturnsUndefinedIfNoDevicesAreAvailable = () => {
      it('returns undefined if no devices are available', () => {
        [
          undefined,
          { name: 'Big Microphone', index: 1, uniqueId: 'abc123' },
        ].forEach(preferred => {
          assert.isUndefined(
            findBestMatchingAudioDeviceIndex(
              {
                available: [],
                preferred,
              },
              false
            )
          );
        });
      });
    };

    const itReturnsTheFirstAvailableDeviceIfNoneIsPreferred = () => {
      it('returns the first available device if none is preferred', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex(
            {
              available: [
                { name: 'A', index: 123, uniqueId: 'device-A' },
                { name: 'B', index: 456, uniqueId: 'device-B' },
                { name: 'C', index: 789, uniqueId: 'device-C' },
              ],
              preferred: undefined,
            },
            false
          ),
          0
        );
      });
    };

    const testUniqueIdMatch = () => {
      assert.strictEqual(
        findBestMatchingAudioDeviceIndex(
          {
            available: [
              { name: 'A', index: 123, uniqueId: 'device-A' },
              { name: 'B', index: 456, uniqueId: 'device-B' },
              { name: 'C', index: 789, uniqueId: 'device-C' },
            ],
            preferred: { name: 'Ignored', index: 99, uniqueId: 'device-C' },
          },
          false
        ),
        2
      );
    };

    const testNameMatch = () => {
      assert.strictEqual(
        findBestMatchingAudioDeviceIndex(
          {
            available: [
              { name: 'A', index: 123, uniqueId: 'device-A' },
              { name: 'B', index: 456, uniqueId: 'device-B' },
              { name: 'C', index: 789, uniqueId: 'device-C' },
            ],
            preferred: { name: 'C', index: 99, uniqueId: 'ignored' },
          },
          false
        ),
        2
      );
    };

    const itReturnsTheFirstAvailableDeviceIfThePreferredDeviceIsNotFound =
      () => {
        it('returns the first available device if the preferred device is not found', () => {
          assert.strictEqual(
            findBestMatchingAudioDeviceIndex(
              {
                available: [
                  { name: 'A', index: 123, uniqueId: 'device-A' },
                  { name: 'B', index: 456, uniqueId: 'device-B' },
                  { name: 'C', index: 789, uniqueId: 'device-C' },
                ],
                preferred: { name: 'X', index: 123, uniqueId: 'Y' },
              },
              false
            ),
            0
          );
        });
      };

    describe('find best matching device', () => {
      itReturnsUndefinedIfNoDevicesAreAvailable();

      itReturnsTheFirstAvailableDeviceIfNoneIsPreferred();

      it('returns 0 if that was the previous preferred index (and a device is available)', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex(
            {
              available: [
                { name: 'A', index: 123, uniqueId: 'device-A' },
                { name: 'B', index: 456, uniqueId: 'device-B' },
                { name: 'C', index: 789, uniqueId: 'device-C' },
              ],
              preferred: { name: 'C', index: 0, uniqueId: 'device-C' },
            },
            false
          ),
          0
        );
      });
      it('(windows) returns 1 if that was the previous preferred index (and a device is available)', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex(
            {
              available: [
                { name: 'A', index: 123, uniqueId: 'device-A' },
                { name: 'B', index: 456, uniqueId: 'device-B' },
                { name: 'C', index: 789, uniqueId: 'device-C' },
              ],
              preferred: { name: 'C', index: 1, uniqueId: 'device-C' },
            },
            true
          ),
          1
        );
      });
      it('(non-windows) returns 2 if the preferred device was at index 1 and is now at index 2', () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex(
            {
              available: [
                { name: 'A', index: 123, uniqueId: 'device-A' },
                { name: 'B', index: 456, uniqueId: 'device-B' },
                { name: 'C', index: 789, uniqueId: 'device-C' },
              ],
              preferred: { name: 'C', index: 1, uniqueId: 'device-C' },
            },
            false
          ),
          2
        );
      });

      it("returns 0 if the previous preferred index was 1 but there's only 1 audio device", () => {
        assert.strictEqual(
          findBestMatchingAudioDeviceIndex(
            {
              available: [{ name: 'A', index: 123, uniqueId: 'device-A' }],
              preferred: { name: 'C', index: 1, uniqueId: 'device-C' },
            },
            false
          ),
          0
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
