// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DurationInSeconds } from './durations/duration-in-seconds.std.js';

export function getPinnedMessageExpiresAt(
  receivedAtTimestamp: number,
  pinDuration: DurationInSeconds | null
): number | null {
  if (pinDuration == null) {
    return null;
  }
  const pinDurationMs = DurationInSeconds.toMillis(pinDuration);
  return receivedAtTimestamp + pinDurationMs;
}
