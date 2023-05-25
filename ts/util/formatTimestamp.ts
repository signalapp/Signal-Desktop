// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assertDev } from './assert';

export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions
): string {
  const locale = window.getPreferredSystemLocales();
  try {
    return new Intl.DateTimeFormat(locale, options).format(timestamp);
  } catch (err) {
    assertDev(false, 'invalid timestamp');
    return '';
  }
}
