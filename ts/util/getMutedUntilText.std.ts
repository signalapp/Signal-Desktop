// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';
import type { LocalizerType } from '../types/Util.std.js';
import { isToday } from './timestamp.std.js';

/**
 * Returns something like "Muted until 6:09 PM", localized.
 *
 * Shouldn't be called with `0`.
 */
export function getMutedUntilText(
  muteExpiresAt: number,
  i18n: LocalizerType
): string {
  if (Number(muteExpiresAt) >= Number.MAX_SAFE_INTEGER) {
    return i18n('icu:muteExpirationLabelAlways');
  }

  const expires = moment(muteExpiresAt);
  const muteExpirationUntil = isToday(expires)
    ? expires.format('LT')
    : expires.format('L, LT');

  return i18n('icu:muteExpirationLabel', {
    duration: muteExpirationUntil,
  });
}
