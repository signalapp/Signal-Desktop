// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';

export function getMessageAge(
  now: number,
  message: Pick<ReadonlyMessageAttributesType, 'serverTimestamp' | 'sent_at'>
): number {
  const messageTimestamp = message.serverTimestamp ?? message.sent_at ?? 0;
  return Math.abs(now - messageTimestamp);
}
