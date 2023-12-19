// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';
import { DAY } from './durations';

export function isTooOldToModifyMessage(
  serverTimestamp: number,
  message: MessageAttributesType
): boolean {
  const messageTimestamp = message.serverTimestamp || message.sent_at || 0;
  const delta = Math.abs(serverTimestamp - messageTimestamp);
  return delta > DAY * 2;
}
