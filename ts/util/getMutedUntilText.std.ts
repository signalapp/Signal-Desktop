// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';
import { MuteExpiration } from '@signalapp/types';
import type { LocalizerType } from '../types/Util.std.ts';
import { isToday } from './timestamp.std.ts';

/**
 * Returns something like "Muted until 6:09 PM", localized.
 *
 * Shouldn't be called with MuteExpiration.UNMUTED.
 */
export function getMutedUntilText(
  muteExpiresAt: MuteExpiration,
  i18n: LocalizerType
): string {
  if (MuteExpiration.isAlways(muteExpiresAt)) {
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
