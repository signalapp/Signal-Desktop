// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MINUTE } from './durations/index.std.ts';

function getTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function startTimeZoneChangeDetector(
  onTimeZoneChange: () => void
): void {
  let lastTimeZone = getTimeZone();
  setInterval(() => {
    const currentTimeZone = getTimeZone();
    if (currentTimeZone !== lastTimeZone) {
      lastTimeZone = currentTimeZone;
      onTimeZoneChange();
    }
  }, MINUTE);
}
