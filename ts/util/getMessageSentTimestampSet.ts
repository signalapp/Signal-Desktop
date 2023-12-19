// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../model-types.d';

export function getMessageSentTimestampSet({
  sent_at: sentAt,
  editHistory,
}: Pick<
  MessageAttributesType,
  'sent_at' | 'editHistory'
>): ReadonlySet<number> {
  return new Set([
    sentAt,
    ...(editHistory?.map(({ timestamp }) => timestamp) ?? []),
  ]);
}
