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

  const check = () => {
    const currentTimeZone = getTimeZone();
    if (currentTimeZone !== lastTimeZone) {
      lastTimeZone = currentTimeZone;
      onTimeZoneChange();
    }
  };

  setInterval(check, MINUTE);

  if (
    typeof window !== 'undefined' &&
    typeof window.addEventListener === 'function'
  ) {
    window.addEventListener('focus', check);
  }
}
