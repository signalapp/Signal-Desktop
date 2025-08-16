// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import * as EmbeddedContact from '../types/EmbeddedContact';

export function getQuoteBodyText(
  messageAttributes: ReadonlyMessageAttributesType,
  id: number | null
): string | undefined {
  const storyReactionEmoji = messageAttributes.storyReaction?.emoji;

  if (id != null) {
    const { editHistory } = messageAttributes;
    const editedMessage =
      editHistory && editHistory.find(edit => edit.timestamp === id);

    if (editedMessage && editedMessage.body) {
      return editedMessage.body;
    }
  }

  const { body, contact: embeddedContact } = messageAttributes;
  const embeddedContactName =
    embeddedContact && embeddedContact.length > 0
      ? EmbeddedContact.getName(embeddedContact[0])
      : '';

  return body || embeddedContactName || storyReactionEmoji;
}
