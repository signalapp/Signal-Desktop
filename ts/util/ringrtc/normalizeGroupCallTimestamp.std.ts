// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Normalizes RingRTC group call timestamps (`addedTime` and `speakerTime`) into numbers.
 */
export function normalizeGroupCallTimestamp(
  fromRingRtc: string
): undefined | number {
  const asNumber = parseInt(fromRingRtc.slice(0, 15), 10);

  if (Number.isNaN(asNumber) || asNumber <= 0) {
    return undefined;
  }

  return asNumber;
}
