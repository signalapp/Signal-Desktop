// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

export function hasDraft(
  attrs: Pick<
    ConversationAttributesType,
    'draft' | 'draftAttachments' | 'quotedMessageId'
  >
): boolean {
  return (
    (attrs.draft != null && attrs.draft.length > 1) ||
    (attrs.draftAttachments != null && attrs.draftAttachments.length > 1) ||
    attrs.quotedMessageId != null
  );
}
