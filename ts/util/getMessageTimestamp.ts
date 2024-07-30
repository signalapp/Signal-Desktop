// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';

export function getMessageTimestamp(
  message: Pick<ReadonlyMessageAttributesType, 'received_at' | 'received_at_ms'>
): number {
  return message.received_at_ms || message.received_at;
}
