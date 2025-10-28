// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

export function hasDraft(attributes: ConversationAttributesType): boolean {
  const draftAttachments = attributes.draftAttachments || [];

  return (attributes.draft ||
    attributes.quotedMessageId ||
    draftAttachments.length > 0) as boolean;
}
