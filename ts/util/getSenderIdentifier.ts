// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';

export function getSenderIdentifier({
  sent_at: sentAt,
  source,
  sourceServiceId,
  sourceDevice,
}: Pick<
  ReadonlyMessageAttributesType,
  'sent_at' | 'source' | 'sourceServiceId' | 'sourceDevice'
>): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const conversation = window.ConversationController.lookupOrCreate({
    e164: source,
    serviceId: sourceServiceId,
    reason: `MessageModel.getSenderIdentifier(${sentAt})`,
  })!;

  return `${conversation?.id}.${sourceDevice}-${sentAt}`;
}
