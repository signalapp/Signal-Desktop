// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { LocalizerType } from '../types/Util.std.js';
import * as EmbeddedContact from '../types/EmbeddedContact.std.js';

export function getQuoteBodyText({
  messageAttributes,
  id,
  i18n,
}: {
  messageAttributes: ReadonlyMessageAttributesType;
  id: number | null;
  i18n: LocalizerType;
}): string | undefined {
  const storyReactionEmoji = messageAttributes.storyReaction?.emoji;

  if (id != null) {
    const { editHistory } = messageAttributes;
    const editedMessage =
      editHistory && editHistory.find(edit => edit.timestamp === id);

    if (editedMessage && editedMessage.body) {
      return editedMessage.body;
    }
  }

  const { body, contact: embeddedContact, poll } = messageAttributes;
  const embeddedContactName =
    embeddedContact && embeddedContact.length > 0
      ? EmbeddedContact.getName(embeddedContact[0])
      : '';

  const pollText = poll
    ? i18n('icu:Poll--preview', {
        pollQuestion: poll.question,
      })
    : undefined;

  return body || embeddedContactName || pollText || storyReactionEmoji;
}
