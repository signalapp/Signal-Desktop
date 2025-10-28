// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

import type {
  ReadonlyMessageAttributesType,
  QuotedMessageType,
} from '../model-types.d.ts';
import { getSourceServiceId } from './sources.preload.js';

export function isQuoteAMatch(
  message: ReadonlyMessageAttributesType | null | undefined,
  conversationId: string,
  quote: ReadonlyDeep<Pick<QuotedMessageType, 'id' | 'authorAci'>>
): message is ReadonlyMessageAttributesType {
  if (!message) {
    return false;
  }

  const { authorAci, id } = quote;

  const isSameTimestamp =
    message.sent_at === id ||
    message.editHistory?.some(({ timestamp }) => timestamp === id) ||
    false;

  return (
    isSameTimestamp &&
    message.conversationId === conversationId &&
    getSourceServiceId(message) === authorAci
  );
}
