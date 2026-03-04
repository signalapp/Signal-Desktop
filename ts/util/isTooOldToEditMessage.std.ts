// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { getMessageAge } from './getMessageAge.std.js';
import { DAY } from './durations/index.std.js';

export function isTooOldToEditMessage(
  serverTimestamp: number,
  message: Pick<ReadonlyMessageAttributesType, 'serverTimestamp' | 'sent_at'>
): boolean {
  return getMessageAge(serverTimestamp, message) > DAY * 2;
}
