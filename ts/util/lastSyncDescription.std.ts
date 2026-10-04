// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/I18N.std.ts';

export function getLastSyncDescription(
  i18n: LocalizerType,
  lastSyncTime: number | undefined
): string {
  const lastSyncDate = new Date(lastSyncTime || 0);

  return i18n('icu:Preferences--lastSynced', {
    date: lastSyncDate.toLocaleDateString(),
    time: lastSyncDate.toLocaleTimeString(),
  });
}
